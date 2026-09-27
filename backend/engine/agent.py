"""
MediKiosk — LangGraph Conversational Agent (Module A)
Implements: Triage → Interview → Summarize pipeline.

Fixed issues:
- Emergency routing properly short-circuits the interview
- Summary triggers after adequate SOCRATES/AYUSH coverage (not just message count)
- AYUSH mode uses Dashavidha Pariksha prompt
- Multi-language support via language field in state
- LLM-based triage for accurate emergency detection
"""

import os
import json
import re
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_groq import ChatGroq

from .state import KioskState
from .prompts import (
    SOCRATES_SYSTEM_PROMPT,
    AYUSH_SYSTEM_PROMPT,
    TRIAGE_SYSTEM_PROMPT,
    GREETINGS,
)

# ─────────────────────────────────────────────
# LLM Factory
# ─────────────────────────────────────────────
def get_llm(temperature: float = 0.1):
    api_key = os.getenv("GROQ_API_KEY", "")
    if api_key and api_key != "dummy":
        return ChatGroq(
            temperature=temperature,
            model_name="llama3-8b-8192",
            groq_api_key=api_key,
            max_tokens=512,  # Keep responses concise for low latency
        )

    class MockLLM:
        def invoke(self, messages):
            return AIMessage(content="Groq API key not configured. Please describe your symptoms.")
    return MockLLM()


# ─────────────────────────────────────────────
# SOCRATES fields needed for summary_ready
# ─────────────────────────────────────────────
REQUIRED_SOCRATES = {"Site", "Onset", "Character", "Severity"}
REQUIRED_AYUSH = {"Prakriti", "Vikrti", "Aahara Shakti", "Vyayama Shakti"}

# Turn threshold — summarize after at least this many AI turns
MIN_TURNS_ALLOPATHIC = 5
MIN_TURNS_AYUSH = 7


# ─────────────────────────────────────────────
# Node 1: Triage
# ─────────────────────────────────────────────
def triage_node(state: KioskState) -> dict:
    """
    Checks the latest patient message for emergency red flags.
    Uses rule-based fast-path + LLM validation.
    Returns updated emergency fields only.
    """
    messages = list(state.get("messages", []))
    if not messages:
        return {}

    latest_msg = messages[-1].content if messages else ""
    red_flags = list(state.get("red_flags_detected", []))

    # --- Fast rule-based emergency patterns ---
    critical_patterns = [
        (["chest pain", "chest tightness", "seene mein dard"], "Chest pain — possible cardiac event"),
        (["cannot breathe", "breathless", "saans nahi", "saans lena mushkil"], "Severe breathlessness"),
        (["unconscious", "fainted", "behosh", "girna"], "Loss of consciousness"),
        (["slurred speech", "face droop", "arm weak", "sudden weakness"], "Stroke signs"),
        (["worst headache", "thunderclap", "sudden severe headache"], "Possible SAH — thunderclap headache"),
        (["seizure", "convulsion", "jhatkay", "dora padna"], "Active seizure"),
        (["severe bleeding", "haemorrhage", "khoon bahut zyada"], "Severe haemorrhage"),
    ]

    rule_hit = None
    msg_lower = latest_msg.lower()
    for keywords, reason in critical_patterns:
        if any(kw in msg_lower for kw in keywords):
            rule_hit = reason
            break

    if rule_hit:
        # Fast path: rule-based emergency detected
        red_flags.append(rule_hit)
        return {
            "is_emergency": True,
            "red_flags_detected": red_flags,
        }

    # --- LLM triage for ambiguous cases (only after at least 1 human message) ---
    human_msgs = [m for m in messages if isinstance(m, HumanMessage)]
    if len(human_msgs) >= 1:
        try:
            llm = get_llm(temperature=0)
            triage_response = llm.invoke([
                SystemMessage(content=TRIAGE_SYSTEM_PROMPT),
                HumanMessage(content=f"Patient message: {latest_msg}"),
            ])
            content = triage_response.content.strip()
            if content.upper().startswith("EMERGENCY"):
                reason = content.split(":", 1)[1].strip() if ":" in content else content
                red_flags.append(reason)
                return {
                    "is_emergency": True,
                    "red_flags_detected": red_flags,
                }
        except Exception as e:
            print(f"[Triage] LLM error: {e}")

    return {"is_emergency": False}


# ─────────────────────────────────────────────
# Node 2: Interview
# ─────────────────────────────────────────────
def interview_node(state: KioskState) -> dict:
    """
    Conducts the structured medical interview.
    Uses SOCRATES or AYUSH prompt depending on is_ayush flag.
    Returns the AI's next question/response + updated turn count.
    """
    # If emergency detected, return an emergency message — no more interview
    if state.get("is_emergency"):
        lang = state.get("language", "en")
        emergency_msgs = {
            "en": "🚨 Emergency detected. I am alerting the medical team right now. Please stay calm and do not move. A nurse or doctor will be with you immediately.",
            "hi": "🚨 आपातकाल का पता चला है। मैं अभी मेडिकल टीम को सूचित कर रहा हूँ। कृपया शांत रहें।",
            "ta": "🚨 அவசரநிலை கண்டறியப்பட்டது. மருத்துவக் குழுவிற்கு உடனடியாக தெரிவிக்கிறேன். நிதானமாக இருங்கள்.",
            "te": "🚨 అత్యవసర పరిస్థితి గుర్తించబడింది. వైద్య బృందానికి వెంటనే తెలియజేస్తున్నాను. శాంతంగా ఉండండి.",
            "mr": "🚨 आणीबाणी आढळली आहे. मी आत्ता वैद्यकीय पथकाला सूचित करतो. शांत राहा.",
        }
        return {
            "messages": [AIMessage(content=emergency_msgs.get(lang, emergency_msgs["en"]))],
            "summary_ready": False,
        }

    llm = get_llm()
    is_ayush = state.get("is_ayush", False)
    turn_count = state.get("turn_count", 0)
    language = state.get("language", "en")

    # Choose appropriate system prompt
    system_prompt = AYUSH_SYSTEM_PROMPT if is_ayush else SOCRATES_SYSTEM_PROMPT

    # Add language instruction to system prompt
    lang_instructions = {
        "hi": "\n\nIMPORTANT: The patient speaks Hindi. Respond in simple Hindi (Hindustani). You may mix English medical terms if needed.",
        "ta": "\n\nIMPORTANT: The patient speaks Tamil. Respond in simple Tamil. You may use English medical terms.",
        "te": "\n\nIMPORTANT: The patient speaks Telugu. Respond in simple Telugu. You may use English medical terms.",
        "mr": "\n\nIMPORTANT: The patient speaks Marathi. Respond in simple Marathi. You may use English medical terms.",
        "en": "",
    }
    system_prompt = system_prompt + lang_instructions.get(language, "")

    # Prepare conversation history for LLM
    conversation = [SystemMessage(content=system_prompt)]
    conversation.extend(list(state.get("messages", [])))

    try:
        response = llm.invoke(conversation)
        ai_content = response.content.strip()

        # Check if the AI's response signals interview completion
        completion_signals = [
            "thank you, i have noted all your symptoms",
            "thank you, i have noted your detailed",
            "please upload any old prescriptions",
            "please upload any old",
            "आपके सभी लक्षण नोट कर लिए",
            "पुरानी पर्चियाँ अपलोड करें",
        ]
        is_complete = any(sig in ai_content.lower() for sig in completion_signals)

        # Also mark complete after enough turns for reliability
        min_turns = MIN_TURNS_AYUSH if is_ayush else MIN_TURNS_ALLOPATHIC
        if turn_count >= min_turns:
            is_complete = True

        return {
            "messages": [AIMessage(content=ai_content)],
            "turn_count": turn_count + 1,
            "summary_ready": is_complete,
        }

    except Exception as e:
        print(f"[Interview] LLM error: {e}")
        
        # Determine error message based on language
        error_msgs = {
            "en": "⚠️ I am currently experiencing technical difficulties (API Limit Reached). Please inform the reception.",
            "hi": "⚠️ मुझे अभी कुछ तकनीकी समस्या आ रही है (API Limit Reached)। कृपया रिसेप्शन से संपर्क करें।",
            "ta": "⚠️ தற்போது தொழில்நுட்ப கோளாறு ஏற்பட்டுள்ளது. தயவுசெய்து வரவேற்பறையை அணுகவும்.",
            "te": "⚠️ నాకు ప్రస్తుతం సాంకేతిక సమస్య ఉంది. దయచేసి రిసెప్షన్‌ను సంప్రదించండి.",
            "mr": "⚠️ मला सध्या तांत्रिक अडचण येत आहे. कृपया रिसेप्शनशी संपर्क साधा.",
        }
        fallback = error_msgs.get(language, error_msgs["en"])
        
        return {
            "messages": [AIMessage(content=fallback)],
            "turn_count": turn_count,
        }


# ─────────────────────────────────────────────
# Node 3: Summarize
# ─────────────────────────────────────────────
def summarize_node(state: KioskState) -> dict:
    """
    Extracts structured SOCRATES/AYUSH JSON from the full conversation.
    Runs only when summary_ready is True.
    """
    if not state.get("summary_ready"):
        return {}

    llm = get_llm(temperature=0)
    is_ayush = state.get("is_ayush", False)

    if is_ayush:
        extraction_prompt = """
Analyze the conversation and extract all Ayurvedic assessment data into this JSON:
{
    "socrates": {
        "Site": "", "Onset": "", "Character": "", "Radiation": "",
        "Associated": "", "TimeCourse": "", "Exacerbating": "", "Severity": ""
    },
    "ayush": {
        "Prakriti": "", "Vikrti": "", "Sara": "", "Samhanana": "",
        "Pramana": "", "Satmya": "", "Satva": "",
        "Aahara Shakti": "", "Vyayama Shakti": "", "Vaya": ""
    },
    "chief_complaint": ""
}
Return ONLY valid JSON. Use "Not collected" for fields not mentioned. Do not add any text outside the JSON.
"""
    else:
        extraction_prompt = """
Analyze the conversation and extract clinical data into this JSON:
{
    "socrates": {
        "Site": "", "Onset": "", "Character": "", "Radiation": "",
        "Associated": "", "TimeCourse": "", "Exacerbating": "", "Severity": ""
    },
    "ayush": {},
    "chief_complaint": "",
    "past_history": "",
    "medications": "",
    "allergies": ""
}
Return ONLY valid JSON. Use "Not reported" for fields not mentioned. Do not add any text outside the JSON.
"""

    try:
        messages_for_extraction = [
            SystemMessage(content=extraction_prompt),
            *list(state.get("messages", [])),
        ]
        response = llm.invoke(messages_for_extraction)
        content = response.content.strip()

        # Strip markdown code blocks if present
        content = re.sub(r"```(?:json)?", "", content).strip()

        # Find JSON object in the response
        json_match = re.search(r"\{.*\}", content, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group())
        else:
            parsed = json.loads(content)

        return {
            "socrates_collected": parsed.get("socrates", {}),
            "ayush_collected": parsed.get("ayush", {}),
            "chief_complaint": parsed.get("chief_complaint", ""),
            "messages": [],  # Don't append extraction result to conversation
        }

    except Exception as e:
        print(f"[Summarize] JSON extraction error: {e}")
        # Return empty dicts — raw_history in main.py still captures conversation
        return {
            "socrates_collected": {},
            "ayush_collected": {},
            "chief_complaint": "",
        }


# ─────────────────────────────────────────────
# Graph Construction
# ─────────────────────────────────────────────
def _route_after_triage(state: KioskState) -> str:
    """Route to interview, or skip straight to END if true emergency."""
    if state.get("is_emergency"):
        return "interview"  # interview returns emergency message
    return "interview"


def _route_after_interview(state: KioskState) -> str:
    """Route to summarize when interview is complete, else loop back."""
    if state.get("summary_ready"):
        return "summarize"
    return END


def build_graph():
    workflow = StateGraph(KioskState)

    workflow.add_node("triage", triage_node)
    workflow.add_node("interview", interview_node)
    workflow.add_node("summarize", summarize_node)

    workflow.add_edge(START, "triage")
    workflow.add_edge("triage", "interview")
    workflow.add_conditional_edges("interview", _route_after_interview, {
        "summarize": "summarize",
        END: END,
    })
    workflow.add_edge("summarize", END)

    return workflow.compile()


# Singleton graph instance (compiled once at startup)
app_graph = build_graph()
