"""
MediKiosk Backend API — v2.0
FastAPI application for the AI Clinical History Platform.

Architecture:
  Module A — Conversational History Engine (/api/chat, /api/chat/audio, /api/tts)
  Module B — Document Digitisation & OCR (/api/upload)
  Module C — Clinical Summary Generator (/api/patients/*)
  Module D — Identity & Persistence (ABHA + Patient Profile) (/api/auth/*, /api/profile/*)
  Module E — Doctor & Reception APIs (/api/doctors)
"""

from fastapi import FastAPI, UploadFile, File, Form, Depends, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import requests
import base64
import json
from datetime import datetime
from typing import Optional

load_dotenv()

# ─────────────────────────────────────────────
# App Setup
# ─────────────────────────────────────────────
app = FastAPI(
    title="MediKiosk API",
    version="2.0.0",
    description="AI Clinical History Platform for Indian Public Hospitals",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# DB Setup
# ─────────────────────────────────────────────
from database import engine, SessionLocal, run_migrations
import models

models.Base.metadata.create_all(bind=engine)
run_migrations()  # Add new columns to existing NeonDB tables without data loss



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─────────────────────────────────────────────
# Engine Imports
# ─────────────────────────────────────────────
from engine.bhashini import BhashiniClient
from engine.agent import app_graph
from engine.summarizer import generate_prose_summary, generate_patient_summary
from langchain_core.messages import HumanMessage, AIMessage

# In-memory session store (keyed by patient_id)
# For production: replace with Redis using REDIS_URL from .env
session_store: dict = {}


# ─────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────
class ChatRequest(BaseModel):
    patient_id: str
    message: str
    language: str = "en"
    is_ayush: bool = False


class AbhaAuthRequest(BaseModel):
    abha_id: str


class GuestAuthRequest(BaseModel):
    name: str
    age: int
    gender: str
    contact: Optional[str] = None


class SessionCompleteRequest(BaseModel):
    patient_id: str
    visit_id: int
    language: str = "en"


class AssignDoctorRequest(BaseModel):
    patient_id: str
    doctor_id: str


# ─────────────────────────────────────────────
# Demo / Seed Data
# ─────────────────────────────────────────────
DEMO_PATIENTS = [
    {
        "id": "DEMO-001",
        "name": "Ravi Kumar",
        "age": 45,
        "gender": "Male",
        "abha_id": "91-1234-5678-0001",
        "contact": "9812345678",
        "language": "hi",
        "chief_complaint": "Chest pain since 2 days, radiating to left arm",
        "status": "Summary Ready",
        "is_emergency": False,
        "source": "Kiosk Terminal",
        "assigned_doctor": "Dr. Anuj Sharma",
        "is_ayush": False,
        "socrates": {
            "Site": "Central chest",
            "Onset": "2 days ago",
            "Character": "Crushing, pressure-like",
            "Radiation": "Left arm and jaw",
            "Associated": "Mild sweating, breathlessness",
            "TimeCourse": "Intermittent, worsens on exertion",
            "Exacerbating": "Physical activity",
            "Severity": "7/10",
        },
        "ayush": {},
        "documents": [
            {
                "filename": "ecg_report.jpg",
                "extracted_data": "ECG: ST-segment changes noted in leads V1-V4.\nMedication: Aspirin 75mg OD, Atorvastatin 20mg OD.\nDiagnosis: Stable Angina (provisional).",
            }
        ],
        "red_flags": [],
        "prose_summary": "Mr. Ravi Kumar, 45M, presents with a 2-day history of crushing, pressure-like central chest pain (7/10), radiating to the left arm and jaw, intermittent and worsening on exertion. Associated mild diaphoresis and breathlessness. ECG shows ST-segment changes in V1-V4. Currently on Aspirin 75mg OD and Atorvastatin 20mg OD. Provisional diagnosis: Stable Angina. Suggested: Urgent cardiology review, troponin I/T, serial ECG, ECHO.",
        "raw_history": "Patient: I have been having chest pain for 2 days now.\nAI: Can you describe where exactly the pain is?\nPatient: It is in the center of my chest and sometimes goes to my left arm.\nAI: How severe is the pain on a scale of 1-10?\nPatient: About 7 out of 10.\nAI: Do you have any other symptoms like sweating or breathlessness?\nPatient: Yes, some sweating and a little breathlessness when I walk.",
    },
    {
        "id": "DEMO-002",
        "name": "Meena Devi",
        "age": 62,
        "gender": "Female",
        "abha_id": "91-9876-5432-0002",
        "contact": "9987654321",
        "language": "hi",
        "chief_complaint": "Diabetes follow-up, fatigue, peripheral neuropathy",
        "status": "In Session",
        "is_emergency": False,
        "source": "Kiosk Terminal",
        "assigned_doctor": "Dr. Priya Gupta",
        "is_ayush": False,
        "socrates": {
            "Site": "N/A — Chronic systemic condition",
            "Onset": "Type 2 DM diagnosed 8 years ago",
            "Character": "Fatigue, increased thirst, tingling in feet",
            "Radiation": "Peripheral neuropathy — bilateral feet",
            "Associated": "Frequent urination, blurred vision occasionally",
            "TimeCourse": "Chronic, managed — recent worsening fatigue",
            "Exacerbating": "Irregular diet, missed medication",
            "Severity": "4/10 (managed)",
        },
        "ayush": {},
        "documents": [
            {
                "filename": "lab_report_aug.jpg",
                "extracted_data": "HbA1c: 8.2% (↑ High — Target <7%).\nFasting Glucose: 182 mg/dL (↑ High).\nCreatinine: 1.1 mg/dL (Normal).\nCurrent Meds: Metformin 500mg BD, Glimepiride 2mg OD.",
            }
        ],
        "red_flags": [],
        "prose_summary": "Mrs. Meena Devi, 62F, T2DM for 8 years, presents for follow-up with complaints of fatigue, increased thirst, frequent urination, and tingling in both feet. HbA1c 8.2% (↑), Fasting Glucose 182 mg/dL (↑), Creatinine 1.1 mg/dL (normal). On Metformin 500mg BD + Glimepiride 2mg OD. Suggests suboptimal glycaemic control. Consider: medication review, dietary counselling, neuropathy assessment, renal function monitoring.",
        "raw_history": "Patient: I came for my diabetes check-up.\nAI: How have you been feeling lately?\nPatient: Very tired and my feet tingle, especially at night.\nAI: Are you taking your medications regularly?\nPatient: Sometimes I forget the evening tablet.",
    },
    {
        "id": "DEMO-003",
        "name": "Arjun Singh",
        "age": 28,
        "gender": "Male",
        "abha_id": "91-1111-2222-0003",
        "contact": "9765432100",
        "language": "en",
        "chief_complaint": "EMERGENCY — Thunderclap headache, vomiting, neck stiffness",
        "status": "EMERGENCY",
        "is_emergency": True,
        "source": "Kiosk Terminal",
        "assigned_doctor": "TRIAGE — Neurology",
        "is_ayush": False,
        "socrates": {
            "Site": "Entire head, worst at occiput/back of neck",
            "Onset": "Sudden onset — 1 hour ago",
            "Character": "Thunderclap — worst headache of life",
            "Radiation": "Neck stiffness, photophobia",
            "Associated": "Vomiting ×3, photophobia, phonophobia",
            "TimeCourse": "Constant since onset, not improving",
            "Exacerbating": "Movement, bright light, noise",
            "Severity": "10/10",
        },
        "ayush": {},
        "documents": [],
        "red_flags": [
            "Thunderclap headache — possible Subarachnoid Haemorrhage (SAH)",
            "Neck stiffness + photophobia — meningism signs",
            "Sudden onset — rules out benign causes",
        ],
        "prose_summary": "Mr. Arjun Singh, 28M, EMERGENCY. Presents with sudden-onset thunderclap headache (10/10) 1 hour ago — 'worst headache of his life'. Associated neck stiffness, photophobia, phonophobia, and vomiting ×3. Constant since onset. Clinical picture highly suspicious for Subarachnoid Haemorrhage (SAH) or bacterial meningitis. IMMEDIATE: Non-contrast CT head, LP if CT negative, IV access, neurology/neurosurgery alert.",
        "raw_history": "Patient: My head is hurting so much, worst in my life.\nAI: When did this start?\nPatient: About an hour ago, suddenly.\nAI: Any other symptoms?\nPatient: I vomited 3 times and light hurts my eyes.\n[EMERGENCY PROTOCOL ACTIVATED — TRIAGE ALERTED]",
    },
    {
        "id": "DEMO-004",
        "name": "Lakshmi Venkataraman",
        "age": 52,
        "gender": "Female",
        "abha_id": "91-3333-4444-0004",
        "contact": "9444123456",
        "language": "ta",
        "chief_complaint": "Joint pain, digestive issues — AYUSH OPD",
        "status": "Summary Ready",
        "is_emergency": False,
        "source": "Kiosk Terminal",
        "assigned_doctor": "Dr. Ramesh Verma (AYUSH)",
        "is_ayush": True,
        "socrates": {
            "Site": "Bilateral knee joints, lower back",
            "Onset": "Progressive over 3 years",
            "Character": "Dull aching, stiffness in mornings",
            "Radiation": "Occasionally to hips",
            "Associated": "Poor digestion, bloating, constipation",
            "TimeCourse": "Chronic, worsening in winter",
            "Exacerbating": "Cold weather, overexertion",
            "Severity": "5/10",
        },
        "ayush": {
            "Prakriti": "Vata-Kapha dominant",
            "Vikrti": "Vata aggravation (joint stiffness, dry skin)",
            "Sara": "Moderate — skin dry, hair brittle",
            "Samhanana": "Medium build, tending to heaviness",
            "Pramana": "Appetite irregular, thirst low",
            "Satmya": "Warm foods, oil massage suits well",
            "Satva": "Moderate — handles stress reasonably",
            "Aahara Shakti": "Manda Agni (slow digestion), bloating after meals",
            "Vyayama Shakti": "Low — gets tired easily, avoids exercise",
            "Vaya": "52 years — Vata predominant life stage",
        },
        "documents": [],
        "red_flags": [],
        "prose_summary": "Mrs. Lakshmi Venkataraman, 52F, AYUSH OPD. Presents with 3-year history of bilateral knee joint pain and lower back stiffness (5/10), worsening in cold weather. Associated bloating and constipation. Dashavidha Pariksha: Prakriti — Vata-Kapha; Vikrti — Vata aggravation; Agni — Manda (slow); Vyayama Shakti — Low. Clinical impression: Vata-dominant Sandhivata (Osteoarthritis equivalent) with Agni dushti. Suggested: Panchakarma assessment, Abhyanga, dietary modification towards warming foods.",
        "raw_history": "Patient: My knees have been paining for 3 years and digestion is bad.\nAI: When is the pain worse — morning or evening?\nPatient: Morning is worse, stiff for an hour after waking.\nAI: What is your diet like? Do you eat warm or cold foods?\nPatient: Mostly cold food, leftovers. Digestion is slow and I feel bloated.",
    },
]

DEMO_DOCTORS = [
    {"id": "DOC-001", "name": "Dr. Anuj Sharma", "department": "Cardiology", "is_available": True, "patients_today": 24, "speciality": "Allopathic"},
    {"id": "DOC-002", "name": "Dr. Priya Gupta", "department": "Internal Medicine / Diabetology", "is_available": True, "patients_today": 31, "speciality": "Allopathic"},
    {"id": "DOC-003", "name": "Dr. Ramesh Verma", "department": "Ayurveda (AYUSH)", "is_available": False, "patients_today": 18, "speciality": "AYUSH"},
    {"id": "DOC-004", "name": "Dr. Sunita Patel", "department": "General OPD", "is_available": True, "patients_today": 42, "speciality": "Allopathic"},
    {"id": "DOC-005", "name": "Dr. Kavitha Nair", "department": "Neurology", "is_available": True, "patients_today": 12, "speciality": "Allopathic"},
]


# ─────────────────────────────────────────────
# Helper: Initialise blank session state
# ─────────────────────────────────────────────
def init_session(patient_id: str, language: str = "en", is_ayush: bool = False, patient_name: str = "") -> dict:
    return {
        "messages": [],
        "patient_id": patient_id,
        "patient_name": patient_name,
        "language": language,
        "is_ayush": is_ayush,
        "socrates_collected": {},
        "ayush_collected": {},
        "red_flags_detected": [],
        "is_emergency": False,
        "summary_ready": False,
        "documents": [],
        "turn_count": 0,
        "fields_collected": [],
        "chief_complaint": "",
    }


# ─────────────────────────────────────────────
# MODULE A — Conversational History Engine
# ─────────────────────────────────────────────

@app.get("/api/chat/greet")
async def chat_greet(patient_id: str, language: str = "en", is_ayush: bool = False):
    """
    Returns the initial AI greeting when the kiosk chat screen opens.
    The AI speaks first — patient never has to start blind.
    """
    from engine.prompts import GREETINGS
    greeting = GREETINGS.get(language, GREETINGS["en"])
    # Bootstrap the session so it knows language preference
    if patient_id not in session_store:
        session_store[patient_id] = init_session(patient_id, language, is_ayush)
    session_store[patient_id]["language"] = language
    session_store[patient_id]["is_ayush"] = is_ayush
    return {"status": "OK", "message": greeting}


@app.post("/api/chat")
async def chat_text(req: ChatRequest):
    """Text-based conversation with the AI clinical history agent."""
    if req.patient_id not in session_store:
        session_store[req.patient_id] = init_session(
            req.patient_id, req.language, req.is_ayush
        )

    state = session_store[req.patient_id]
    # Update language if user changed it mid-session
    state["language"] = req.language
    state["messages"] = list(state.get("messages", [])) + [HumanMessage(content=req.message)]

    try:
        updated_state = app_graph.invoke(state)
        session_store[req.patient_id] = updated_state

        if updated_state.get("is_emergency"):
            return {
                "status": "EMERGENCY_ALERT",
                "message": updated_state["messages"][-1].content if updated_state.get("messages") else "Emergency detected.",
                "red_flags": updated_state.get("red_flags_detected", []),
            }

        messages = updated_state.get("messages", [])
        ai_msg = messages[-1].content if messages else "Please describe your symptoms."

        return {
            "status": "OK",
            "message": ai_msg,
            "summary_ready": updated_state.get("summary_ready", False),
            "turn_count": updated_state.get("turn_count", 0),
        }
    except Exception as e:
        print(f"[Chat] Error: {e}")
        return {"status": "ERROR", "message": "I'm having trouble connecting. Please try again."}


@app.post("/api/chat/audio")
async def chat_audio(
    patient_id: str = Form(...),
    audio: UploadFile = File(...),
    language: str = Form("en"),
    is_ayush: str = Form("false"),
):
    """Audio-based conversation: ASR → LangGraph agent → TTS response."""
    is_ayush_bool = is_ayush.lower() == "true"

    if patient_id not in session_store:
        session_store[patient_id] = init_session(patient_id, language, is_ayush_bool)

    file_bytes = await audio.read()
    if len(file_bytes) < 200:
        return {"error": "Audio too short. Hold the mic button longer and speak clearly."}

    try:
        bhashini = BhashiniClient()
        transcript = bhashini.speech_to_text(file_bytes, source_language=language)

        if not transcript or "error" in transcript.lower() or transcript == "__ERROR__":
            return {"error": "Could not transcribe audio. Please try typing or speak clearly."}

        print(f"[ASR] Transcript ({language}): {transcript}")

        state = session_store[patient_id]
        state["language"] = language
        state["messages"] = list(state.get("messages", [])) + [HumanMessage(content=transcript)]

        updated_state = app_graph.invoke(state)
        session_store[patient_id] = updated_state

        messages = updated_state.get("messages", [])
        ai_msg = messages[-1].content if messages else "Please tell me more about your symptoms."

        return {
            "status": "EMERGENCY_ALERT" if updated_state.get("is_emergency") else "SUCCESS",
            "transcription": transcript,
            "message": ai_msg,
            "summary_ready": updated_state.get("summary_ready", False),
            "red_flags": updated_state.get("red_flags_detected", []),
            "turn_count": updated_state.get("turn_count", 0),
        }

    except Exception as e:
        print(f"[Audio Chat] Error: {e}")
        return {"error": f"Audio processing failed: {str(e)}"}


@app.get("/api/tts")
async def get_tts(text: str, language: str = "en"):
    """Text-to-speech endpoint. Returns MP3 audio bytes."""
    try:
        bhashini = BhashiniClient()
        audio_bytes = bhashini.text_to_speech(text[:400], target_language=language)
        if not audio_bytes:
            raise ValueError("Empty audio returned")
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        print(f"[TTS] Error: {e}")
        return Response(status_code=204)  # No content — client handles silently


# ─────────────────────────────────────────────
# MODULE B — Document Digitisation & OCR
# ─────────────────────────────────────────────

@app.post("/api/upload")
async def upload_document(patient_id: str = Form(...), file: UploadFile = File(...)):
    """
    Accepts an image of a prescription/lab report.
    Uses Groq Vision (llama-3.2-11b) to extract diagnoses, medications, lab values.
    """
    if patient_id not in session_store:
        session_store[patient_id] = init_session(patient_id)

    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        return {"error": "OCR service not configured."}

    try:
        file_bytes = await file.read()
        mime_type = file.content_type or "image/jpeg"

        if not mime_type.startswith("image/"):
            return {"error": "Only image files are supported (JPG, PNG, WebP)."}

        b64_image = base64.b64encode(file_bytes).decode("utf-8")

        extraction_prompt = (
            "You are a medical AI assistant analyzing a prescription or lab report image.\n\n"
            "Extract the following information and format as structured text:\n"
            "1. DIAGNOSES / CONDITIONS: (list each diagnosis)\n"
            "2. MEDICATIONS: (name, dose, frequency for each)\n"
            "3. LAB VALUES: (test name, value, unit, reference range, flag if abnormal ↑↓)\n"
            "4. DATES: (report date, prescription date)\n"
            "5. DOCTOR/HOSPITAL: (if visible)\n\n"
            "If the image is handwritten, do your best to read it. "
            "Output only the extracted data, no preamble."
        )

        payload = {
            "model": "llama-3.2-11b-vision-preview",
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": extraction_prompt},
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64_image}"}},
                ],
            }],
            "temperature": 0.1,
            "max_tokens": 800,
        }

        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers, json=payload, timeout=30,
        )

        if resp.status_code != 200:
            print(f"[OCR] Groq Vision error: {resp.text[:200]}")
            return {"error": "Document analysis failed. Please try a clearer image."}

        extracted = resp.json()["choices"][0]["message"]["content"].strip()

        # Store in session
        session_store[patient_id].setdefault("documents", []).append({
            "filename": file.filename or "document.jpg",
            "extracted_data": extracted,
            "uploaded_at": datetime.utcnow().isoformat(),
        })

        return {"status": "SUCCESS", "extracted_data": extracted, "filename": file.filename}

    except Exception as e:
        print(f"[OCR] Exception: {e}")
        return {"error": f"Upload failed: {str(e)}"}


# ─────────────────────────────────────────────
# MODULE D — Identity & Persistence
# ─────────────────────────────────────────────

@app.post("/api/auth/abha")
def auth_abha(req: AbhaAuthRequest, db: Session = Depends(get_db)):
    """
    ABHA ID authentication. Looks up or creates patient profile.
    For demo: any ABHA ID works, returns realistic profile.
    """
    # Check if patient already exists in DB
    patient = db.query(models.PatientProfile).filter(
        models.PatientProfile.abha_id == req.abha_id
    ).first()

    if not patient:
        # Look for matching demo data
        demo = next((d for d in DEMO_PATIENTS if d.get("abha_id") == req.abha_id), None)
        patient = models.PatientProfile(
            abha_id=req.abha_id,
            name=demo["name"] if demo else "Patient",
            age=demo["age"] if demo else 30,
            gender=demo["gender"][0] if demo else "U",
            contact_number=demo.get("contact") if demo else None,
            is_temporary=False,
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)

    # Create a new visit record
    visit = models.Visit(patient_id=patient.id, status="IN_KIOSK")
    db.add(visit)
    db.commit()
    db.refresh(visit)

    return {
        "status": "SUCCESS",
        "patient": {
            "id": str(patient.id),
            "name": patient.name,
            "abha_id": patient.abha_id,
            "age": patient.age,
            "gender": patient.gender,
            "contact": patient.contact_number,
        },
        "visit_id": visit.id,
    }


@app.post("/api/auth/guest")
def auth_guest(req: GuestAuthRequest, db: Session = Depends(get_db)):
    """
    Guest registration — no ABHA ID required.
    Creates a temporary patient account.
    """
    patient = models.PatientProfile(
        abha_id=None,
        name=req.name,
        age=req.age,
        gender=req.gender[0].upper() if req.gender else "U",
        contact_number=req.contact,
        is_temporary=True,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    visit = models.Visit(patient_id=patient.id, status="IN_KIOSK")
    db.add(visit)
    db.commit()
    db.refresh(visit)

    return {
        "status": "SUCCESS",
        "patient": {
            "id": str(patient.id),
            "name": patient.name,
            "abha_id": None,
            "age": patient.age,
            "gender": patient.gender,
            "contact": patient.contact_number,
        },
        "visit_id": visit.id,
        "is_guest": True,
    }


@app.post("/api/session/complete")
def complete_session(req: SessionCompleteRequest, db: Session = Depends(get_db)):
    """Finalises the kiosk session, saves ClinicalSummary to DB, updates visit status."""
    if req.patient_id not in session_store:
        return {"error": "Session not found."}

    state = session_store[req.patient_id]

    # Resolve DB patient ID
    try:
        db_patient_id = int(req.patient_id)
    except ValueError:
        visit = db.query(models.Visit).filter(models.Visit.id == req.visit_id).first()
        db_patient_id = visit.patient_id if visit else 1

    # Build raw history from messages
    messages = state.get("messages", [])
    raw_history = "\n".join([
        f"{'Patient' if isinstance(m, HumanMessage) else 'AI'}: {m.content}"
        for m in messages
    ])

    # Generate prose summary asynchronously in background
    # (stored as JSON in clinical_summaries)
    prose = generate_prose_summary(
        socrates=state.get("socrates_collected", {}),
        ayush=state.get("ayush_collected", {}),
        raw_history=raw_history,
        documents=state.get("documents", []),
        red_flags=state.get("red_flags_detected", []),
        patient_name=state.get("patient_name", ""),
        language=state.get("language", "en"),
    )

    summary = models.ClinicalSummary(
        visit_id=req.visit_id,
        patient_id=db_patient_id,
        chief_complaint=state.get("chief_complaint", ""),
        language=state.get("language", "en"),
        is_ayush=state.get("is_ayush", False),
        socrates_json=json.dumps(state.get("socrates_collected", {}), ensure_ascii=False),
        ayush_json=json.dumps(state.get("ayush_collected", {}), ensure_ascii=False),
        ocr_documents_json=json.dumps(state.get("documents", []), ensure_ascii=False),
        red_flags=json.dumps(state.get("red_flags_detected", []), ensure_ascii=False),
        prose_summary=prose,
        raw_history=raw_history,
    )
    db.add(summary)

    visit = db.query(models.Visit).filter(models.Visit.id == req.visit_id).first()
    if visit:
        visit.status = "WAITING_FOR_DOCTOR"

    db.commit()
    del session_store[req.patient_id]

    return {
        "status": "SUCCESS",
        "message": "Clinical summary saved. Patient is now in the doctor queue.",
        "prose_preview": prose[:200] if prose else "",
    }


# ─────────────────────────────────────────────
# MODULE C — Patient APIs (Reception + Doctor)
# ─────────────────────────────────────────────

@app.get("/api/patients")
def list_patients(db: Session = Depends(get_db)):
    """Returns all active patients: real DB records + live sessions + demo patients."""
    result = []
    
    # 1. Real completed sessions from DB (WAITING_FOR_DOCTOR)
    # Order by desc to get the latest visit first
    db_visits = db.query(models.Visit).filter(models.Visit.status.in_(["WAITING_FOR_DOCTOR", "IN_KIOSK"])).order_by(models.Visit.created_at.desc()).all()
    # To avoid showing IN_KIOSK twice (once from DB, once from session_store), we'll track active IDs
    db_patient_ids = set()
    added_patient_ids = set()
    
    for v in db_visits:
        # If it's still in session_store, let session_store handle the live state
        if str(v.patient_id) in session_store:
            db_patient_ids.add(str(v.patient_id))
            continue
            
        # If we already added this patient from a newer visit, skip duplicates
        if str(v.patient_id) in added_patient_ids:
            continue
            
        summary = v.clinical_summary
        
        # Parse red flags safely
        is_emergency = False
        red_flags_list = []
        if summary and summary.red_flags:
            try:
                red_flags_list = json.loads(summary.red_flags)
                is_emergency = len(red_flags_list) > 0
            except:
                pass
                
        result.append({
            "id": str(v.patient_id),
            "name": v.patient.name,
            "age": v.patient.age,
            "gender": v.patient.gender,
            "abha_id": v.patient.abha_id,
            "language": v.language or "en",
            "is_ayush": v.is_ayush,
            "status": "EMERGENCY" if is_emergency else (
                      "Summary Ready" if v.status == "WAITING_FOR_DOCTOR" else "In Session"
            ),
            "is_emergency": is_emergency,
            "chief_complaint": summary.chief_complaint if summary else "In session",
            "source": "Kiosk Terminal",
            "assigned_doctor": v.doctor.name if v.doctor else "Unassigned",
            "is_demo": False,
        })
        db_patient_ids.add(str(v.patient_id))
        added_patient_ids.add(str(v.patient_id))

    # 2. Live sessions from kiosk (still typing/talking)
    for pid, session in session_store.items():
        if pid in added_patient_ids: continue # Avoid duplicates if something mismatched
        
        msgs = session.get("messages", [])
        from langchain_core.messages import HumanMessage
        first_complaint = next(
            (m.content for m in msgs if isinstance(m, HumanMessage)), "In session"
        )
        result.append({
            "id": str(pid),
            "name": session.get("patient_name") or f"Patient {pid}",
            "age": None,
            "gender": None,
            "abha_id": None,
            "language": session.get("language", "en"),
            "is_ayush": session.get("is_ayush", False),
            "status": "EMERGENCY" if session.get("is_emergency") else
                      ("Summary Ready" if session.get("summary_ready") else "In Session"),
            "is_emergency": session.get("is_emergency", False),
            "chief_complaint": first_complaint[:100],
            "source": "Kiosk Terminal",
            "assigned_doctor": "Unassigned",
            "is_demo": False,
        })

    # 3. Demo patients (always shown so dashboard never looks empty)
    for d in DEMO_PATIENTS:
        result.append({
            "id": d["id"],
            "name": d["name"],
            "age": d["age"],
            "gender": d["gender"],
            "abha_id": d["abha_id"],
            "language": d.get("language", "en"),
            "is_ayush": d.get("is_ayush", False),
            "status": d["status"],
            "is_emergency": d["is_emergency"],
            "chief_complaint": d["chief_complaint"],
            "source": d["source"],
            "assigned_doctor": d["assigned_doctor"],
            "is_demo": True,
        })

    return {"patients": result, "total": len(result)}


@app.get("/api/patients/{patient_id}")
def get_patient_summary(patient_id: str, db: Session = Depends(get_db)):
    """Returns full structured summary for a patient (doctor EMR view)."""
    # 1. Check demo data first
    demo = next((d for d in DEMO_PATIENTS if d["id"] == patient_id), None)
    if demo:
        return {
            "patient_id": demo["id"],
            "name": demo["name"],
            "age": demo["age"],
            "gender": demo["gender"],
            "abha_id": demo["abha_id"],
            "contact": demo.get("contact"),
            "language": demo.get("language", "en"),
            "is_ayush": demo.get("is_ayush", False),
            "is_emergency": demo["is_emergency"],
            "red_flags": demo["red_flags"],
            "chief_complaint": demo["chief_complaint"],
            "raw_history": demo["raw_history"],
            "socrates": demo["socrates"],
            "ayush": demo["ayush"],
            "documents": demo["documents"],
            "prose_summary": demo.get("prose_summary", ""),
            "status": demo["status"],
            "assigned_doctor": demo["assigned_doctor"],
            "is_demo": True,
        }

    # 2. Check Database for real patients (completed sessions)
    try:
        db_patient_id = int(patient_id)
        db_patient = db.query(models.PatientProfile).filter(models.PatientProfile.id == db_patient_id).first()
        if db_patient:
            visit = db.query(models.Visit).filter(models.Visit.patient_id == db_patient_id).order_by(models.Visit.created_at.desc()).first()
            if visit and visit.clinical_summary:
                summary = visit.clinical_summary
                
                red_flags = []
                if summary.red_flags:
                    try: red_flags = json.loads(summary.red_flags)
                    except: pass
                
                socrates = {}
                if summary.socrates_json:
                    try: socrates = json.loads(summary.socrates_json)
                    except: pass
                    
                ayush = {}
                if summary.ayush_json:
                    try: ayush = json.loads(summary.ayush_json)
                    except: pass

                documents = []
                if summary.ocr_documents_json:
                    try: documents = json.loads(summary.ocr_documents_json)
                    except: pass

                return {
                    "patient_id": str(db_patient.id),
                    "name": db_patient.name,
                    "age": db_patient.age,
                    "gender": db_patient.gender,
                    "abha_id": db_patient.abha_id,
                    "contact": db_patient.contact_number,
                    "language": summary.language or "en",
                    "is_ayush": summary.is_ayush,
                    "is_emergency": len(red_flags) > 0,
                    "red_flags": red_flags,
                    "chief_complaint": summary.chief_complaint or "None",
                    "raw_history": summary.raw_history or "",
                    "socrates": socrates,
                    "ayush": ayush,
                    "documents": documents,
                    "prose_summary": summary.prose_summary or "",
                    "status": visit.status,
                    "assigned_doctor": visit.doctor.name if visit.doctor else "Unassigned",
                    "is_demo": False,
                }
    except ValueError:
        pass

    # 3. Live session fallback (still typing/in kiosk)
    if patient_id not in session_store:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found.")

    session = session_store[patient_id]
    msgs = session.get("messages", [])
    from langchain_core.messages import HumanMessage
    raw_history = "\n".join([
        f"{'Patient' if isinstance(m, HumanMessage) else 'AI'}: {m.content}"
        for m in msgs
    ])

    return {
        "patient_id": patient_id,
        "name": session.get("patient_name") or f"Patient {patient_id}",
        "age": None,
        "gender": None,
        "abha_id": None,
        "language": session.get("language", "en"),
        "is_ayush": session.get("is_ayush", False),
        "is_emergency": session.get("is_emergency", False),
        "red_flags": session.get("red_flags_detected", []),
        "chief_complaint": session.get("chief_complaint", ""),
        "raw_history": raw_history,
        "socrates": session.get("socrates_collected", {}),
        "ayush": session.get("ayush_collected", {}),
        "documents": session.get("documents", []),
        "prose_summary": "",
        "status": "EMERGENCY" if session.get("is_emergency") else
                  ("Summary Ready" if session.get("summary_ready") else "In Session"),
        "assigned_doctor": "Unassigned",
        "is_demo": False,
    }


@app.get("/api/patients/{patient_id}/prose-summary")
def get_prose_summary(patient_id: str):
    """
    Generates (or returns cached) physician-ready prose summary for a patient.
    Used by doctor EMR view to display a readable clinical paragraph.
    """
    # Demo patients have pre-generated prose
    demo = next((d for d in DEMO_PATIENTS if d["id"] == patient_id), None)
    if demo:
        return {
            "patient_id": patient_id,
            "prose_summary": demo.get("prose_summary", ""),
            "cached": True,
        }

    if patient_id not in session_store:
        raise HTTPException(status_code=404, detail="Patient session not found.")

    session = session_store[patient_id]
    msgs = session.get("messages", [])
    raw_history = "\n".join([
        f"{'Patient' if isinstance(m, HumanMessage) else 'AI'}: {m.content}"
        for m in msgs
    ])

    prose = generate_prose_summary(
        socrates=session.get("socrates_collected", {}),
        ayush=session.get("ayush_collected", {}),
        raw_history=raw_history,
        documents=session.get("documents", []),
        red_flags=session.get("red_flags_detected", []),
        patient_name=session.get("patient_name", ""),
        language=session.get("language", "en"),
    )

    return {"patient_id": patient_id, "prose_summary": prose, "cached": False}


# ─────────────────────────────────────────────
# MODULE D — Patient Profile (Mobile View)
# ─────────────────────────────────────────────

@app.get("/api/profile/{patient_id}")
def get_patient_profile(patient_id: str, db: Session = Depends(get_db)):
    """
    Returns complete patient profile for self-view on mobile/personal device.
    Shows ABHA-managed data: visits, clinical summaries, AYUSH data, documents.
    """
    # Check demo patients
    demo = next((d for d in DEMO_PATIENTS if d["id"] == patient_id), None)
    if demo:
        patient_summary = generate_patient_summary(
            socrates=demo["socrates"],
            ayush=demo["ayush"],
            chief_complaint=demo["chief_complaint"],
            language=demo.get("language", "en"),
        )
        return {
            "patient_id": demo["id"],
            "name": demo["name"],
            "age": demo["age"],
            "gender": demo["gender"],
            "abha_id": demo["abha_id"],
            "contact": demo.get("contact"),
            "language": demo.get("language", "en"),
            "is_ayush": demo.get("is_ayush", False),
            "chief_complaint": demo["chief_complaint"],
            "socrates": demo["socrates"],
            "ayush": demo["ayush"],
            "documents": demo["documents"],
            "red_flags": demo["red_flags"],
            "assigned_doctor": demo["assigned_doctor"],
            "status": demo["status"],
            "patient_summary": patient_summary,
            "visits": [
                {
                    "date": "2026-09-06",
                    "doctor": demo["assigned_doctor"],
                    "department": "Cardiology" if not demo.get("is_ayush") else "AYUSH OPD",
                    "status": demo["status"],
                    "chief_complaint": demo["chief_complaint"],
                }
            ],
            "is_demo": True,
        }

    # Live session
    if patient_id in session_store:
        session = session_store[patient_id]
        msgs = session.get("messages", [])
        raw_history = "\n".join([
            f"{'Patient' if isinstance(m, HumanMessage) else 'AI'}: {m.content}"
            for m in msgs
        ])
        patient_summary = generate_patient_summary(
            socrates=session.get("socrates_collected", {}),
            ayush=session.get("ayush_collected", {}),
            chief_complaint=session.get("chief_complaint", ""),
            language=session.get("language", "en"),
        )
        return {
            "patient_id": patient_id,
            "name": session.get("patient_name", f"Patient {patient_id}"),
            "language": session.get("language", "en"),
            "is_ayush": session.get("is_ayush", False),
            "chief_complaint": session.get("chief_complaint", ""),
            "socrates": session.get("socrates_collected", {}),
            "ayush": session.get("ayush_collected", {}),
            "documents": session.get("documents", []),
            "red_flags": session.get("red_flags_detected", []),
            "patient_summary": patient_summary,
            "is_demo": False,
        }

    # Try DB lookup
    try:
        db_id = int(patient_id)
        patient = db.query(models.PatientProfile).filter(models.PatientProfile.id == db_id).first()
        if patient:
            visits = db.query(models.Visit).filter(models.Visit.patient_id == patient.id).all()
            return {
                "patient_id": str(patient.id),
                "name": patient.name,
                "age": patient.age,
                "gender": patient.gender,
                "abha_id": patient.abha_id,
                "contact": patient.contact_number,
                "visits": [
                    {
                        "id": v.id,
                        "date": v.created_at.strftime("%Y-%m-%d") if v.created_at else "",
                        "status": v.status,
                    }
                    for v in visits
                ],
                "is_demo": False,
            }
    except (ValueError, Exception) as e:
        print(f"[Profile] DB lookup error: {e}")

    raise HTTPException(status_code=404, detail="Patient profile not found.")


# ─────────────────────────────────────────────
# MODULE E — Doctors API
# ─────────────────────────────────────────────

@app.get("/api/doctors")
def list_doctors():
    return {"doctors": DEMO_DOCTORS}


@app.post("/api/doctors/assign")
def assign_doctor(req: AssignDoctorRequest):
    """Assigns a doctor to a patient session."""
    # Update demo patient if applicable
    for p in DEMO_PATIENTS:
        if p["id"] == req.patient_id:
            doctor = next((d for d in DEMO_DOCTORS if d["id"] == req.doctor_id), None)
            if doctor:
                p["assigned_doctor"] = doctor["name"]
            return {"status": "SUCCESS"}

    # Update live session
    if req.patient_id in session_store:
        doctor = next((d for d in DEMO_DOCTORS if d["id"] == req.doctor_id), None)
        if doctor:
            session_store[req.patient_id]["assigned_doctor"] = doctor["name"]
        return {"status": "SUCCESS"}

    raise HTTPException(status_code=404, detail="Patient not found.")


# ─────────────────────────────────────────────
# Analytics / Dashboard API
# ─────────────────────────────────────────────

@app.get("/api/analytics/overview")
def get_analytics():
    """Returns OPD analytics for the dashboard."""
    all_patients = len(DEMO_PATIENTS) + len(session_store)
    emergencies = sum(1 for d in DEMO_PATIENTS if d["is_emergency"]) + \
                  sum(1 for s in session_store.values() if s.get("is_emergency"))
    summary_ready = sum(1 for d in DEMO_PATIENTS if d["status"] == "Summary Ready") + \
                    sum(1 for s in session_store.values() if s.get("summary_ready"))
    ayush_count = sum(1 for d in DEMO_PATIENTS if d.get("is_ayush"))
    avg_session_min = 4.2  # Demo value

    return {
        "total_patients_today": all_patients,
        "emergencies": emergencies,
        "summary_ready": summary_ready,
        "in_session": all_patients - summary_ready - emergencies,
        "ayush_patients": ayush_count,
        "avg_session_minutes": avg_session_min,
        "doctors_available": sum(1 for d in DEMO_DOCTORS if d["is_available"]),
        "languages": {"en": 2, "hi": 2, "ta": 1, "te": 0, "mr": 0},
        "hourly_flow": [
            {"hour": "8 AM", "patients": 12},
            {"hour": "9 AM", "patients": 28},
            {"hour": "10 AM", "patients": 45},
            {"hour": "11 AM", "patients": 38},
            {"hour": "12 PM", "patients": 22},
            {"hour": "1 PM", "patients": 15},
            {"hour": "2 PM", "patients": 31},
            {"hour": "3 PM", "patients": 42},
            {"hour": "4 PM", "patients": 19},
        ],
        "top_complaints": [
            {"complaint": "Chest Pain", "count": 18},
            {"complaint": "Diabetes Follow-up", "count": 24},
            {"complaint": "Fever / Viral", "count": 31},
            {"complaint": "Joint Pain", "count": 15},
            {"complaint": "Hypertension", "count": 12},
        ],
    }


# ─────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────

@app.get("/")
def health_check():
    return {
        "status": "ok",
        "service": "MediKiosk API v2.0",
        "active_sessions": len(session_store),
        "timestamp": datetime.utcnow().isoformat(),
    }
