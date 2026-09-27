from typing import TypedDict, Annotated, Sequence, Optional
import operator
from langchain_core.messages import BaseMessage


class KioskState(TypedDict):
    """
    Complete state for the MediKiosk Conversational Engine.
    Passed through every node of the LangGraph agent.
    """
    messages: Annotated[Sequence[BaseMessage], operator.add]

    # Patient context
    patient_id: str
    patient_name: Optional[str]
    language: str           # 'en' | 'hi' | 'ta' | 'te' | 'mr'
    is_ayush: bool          # True = Ayurveda OPD, triggers Dashavidha Pariksha

    # SOCRATES parameters (allopathic)
    socrates_collected: dict  # Site, Onset, Character, Radiation, Associated, TimeCourse, Exacerbating, Severity

    # AYUSH / Dashavidha Pariksha parameters
    ayush_collected: dict     # Prakriti, Vikrti, Sara, Samhanana, Pramana, Satmya, Satva, Aahara, Vyayama, Vaya

    # Interview tracking
    turn_count: int           # Number of AI turns completed
    fields_collected: list    # Which SOCRATES/AYUSH fields are filled
    chief_complaint: str      # Extracted chief complaint

    # Emergency
    red_flags_detected: list
    is_emergency: bool

    # Lifecycle
    summary_ready: bool
    documents: list           # Uploaded OCR documents [{filename, extracted_data}]
