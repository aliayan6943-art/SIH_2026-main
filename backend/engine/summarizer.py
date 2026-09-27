"""
MediKiosk — Prose Summary Generator (Module C)
Uses Groq LLaMA-3 to convert structured SOCRATES/AYUSH JSON + raw transcript
into a physician-ready clinical paragraph and a patient-friendly summary.
"""

import os
import json
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from .prompts import PROSE_SUMMARY_PROMPT, PATIENT_SUMMARY_PROMPT


def _get_llm(temperature: float = 0.1):
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set")
    return ChatGroq(
        temperature=temperature,
        model_name="llama3-8b-8192",
        groq_api_key=api_key,
        max_tokens=1024,
    )


def generate_prose_summary(
    socrates: dict,
    ayush: dict,
    raw_history: str,
    documents: list,
    red_flags: list,
    patient_name: str = "",
    language: str = "en",
) -> str:
    """
    Generates a physician-ready clinical paragraph from structured data.
    Returns a plain-text summary string.
    """
    try:
        llm = _get_llm()

        # Build data payload for LLM
        data = {
            "patient_name": patient_name or "Patient",
            "socrates": socrates,
            "ayush": ayush,
            "raw_conversation_excerpt": raw_history[:1500] if raw_history else "",
            "documents_ocr": [
                {"file": d.get("filename", ""), "findings": d.get("extracted_data", "")}
                for d in (documents or [])[:3]  # cap at 3 docs
            ],
            "red_flags": red_flags or [],
        }

        user_content = f"""
Generate a clinical summary from this patient data:

{json.dumps(data, indent=2, ensure_ascii=False)}

Output language: English (clinical documentation standard)
"""

        messages = [
            SystemMessage(content=PROSE_SUMMARY_PROMPT),
            HumanMessage(content=user_content),
        ]

        response = llm.invoke(messages)
        return response.content.strip()

    except Exception as e:
        print(f"[Summarizer] Prose summary error: {e}")
        # Fallback: build a basic summary from the structured data
        return _fallback_prose(socrates, ayush, red_flags, patient_name)


def generate_patient_summary(
    socrates: dict,
    ayush: dict,
    chief_complaint: str,
    language: str = "en",
) -> str:
    """
    Generates a patient-friendly health summary in their language.
    Shown on the Patient Profile page.
    """
    try:
        llm = _get_llm(temperature=0.3)

        lang_names = {
            "en": "English",
            "hi": "Hindi (हिंदी)",
            "ta": "Tamil (தமிழ்)",
            "te": "Telugu (తెలుగు)",
            "mr": "Marathi (मराठी)",
        }

        data = {
            "chief_complaint": chief_complaint,
            "key_symptoms": socrates,
            "ayush_assessment": ayush,
            "language": lang_names.get(language, "English"),
        }

        user_content = f"""
Write a patient-friendly health summary in {lang_names.get(language, "English")}:

{json.dumps(data, indent=2, ensure_ascii=False)}
"""

        messages = [
            SystemMessage(content=PATIENT_SUMMARY_PROMPT),
            HumanMessage(content=user_content),
        ]

        response = llm.invoke(messages)
        return response.content.strip()

    except Exception as e:
        print(f"[Summarizer] Patient summary error: {e}")
        return chief_complaint or "Your health information has been recorded successfully."


def _fallback_prose(socrates: dict, ayush: dict, red_flags: list, patient_name: str) -> str:
    """Simple rule-based fallback if LLM is unavailable."""
    parts = []
    if socrates.get("Site") or socrates.get("Character"):
        hpi = f"{patient_name} presents with {socrates.get('Character', 'complaint')} in the {socrates.get('Site', 'unspecified location')}."
        if socrates.get("Onset"):
            hpi += f" Onset: {socrates['Onset']}."
        if socrates.get("Severity"):
            hpi += f" Severity: {socrates['Severity']}."
        parts.append(hpi)

    if ayush:
        prakriti = ayush.get("Prakriti", "")
        if prakriti:
            parts.append(f"AYUSH Assessment — Prakriti: {prakriti}.")

    if red_flags:
        parts.append(f"⚠ Red Flags: {'; '.join(red_flags)}.")

    return " ".join(parts) if parts else "Clinical data recorded. Please review raw transcript."
