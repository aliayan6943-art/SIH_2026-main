from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class PatientProfile(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    abha_id = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, index=True, nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(String(1), nullable=True)          # M / F / U
    contact_number = Column(String, nullable=True)
    preferred_language = Column(String(5), default="en")
    is_temporary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    visits = relationship("Visit", back_populates="patient")
    referrals = relationship("Referral", back_populates="patient")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    department = Column(String, nullable=False)
    speciality = Column(String, default="Allopathic")
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Visit(Base):
    __tablename__ = "visits"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)

    # Visit lifecycle: WAITING_FOR_KIOSK → IN_KIOSK → WAITING_FOR_DOCTOR → COMPLETED
    status = Column(String, default="WAITING_FOR_KIOSK")

    is_ayush = Column(Boolean, default=False)
    language = Column(String(5), default="en")
    created_at = Column(DateTime, default=datetime.utcnow)
    # updated_at: let DB handle default so it works even before migration adds the column
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        server_default="NOW()",
        nullable=True,
    )

    # Relationships
    patient = relationship("PatientProfile", back_populates="visits")
    doctor = relationship("Doctor")
    clinical_summary = relationship("ClinicalSummary", back_populates="visit", uselist=False)


class ClinicalSummary(Base):
    __tablename__ = "clinical_summaries"

    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)

    # Interview metadata
    chief_complaint = Column(Text, nullable=True)
    language = Column(String(5), default="en")
    is_ayush = Column(Boolean, default=False)

    # Structured data (stored as JSON strings)
    socrates_json = Column(Text, nullable=True)       # SOCRATES parameters
    ayush_json = Column(Text, nullable=True)          # AYUSH Dashavidha Pariksha
    ocr_documents_json = Column(Text, nullable=True)  # Extracted OCR content
    red_flags = Column(Text, nullable=True)           # Emergency flags

    # Generated summaries
    prose_summary = Column(Text, nullable=True)       # Physician-ready paragraph
    raw_history = Column(Text, nullable=True)         # Full conversation transcript

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    visit = relationship("Visit", back_populates="clinical_summary")


class TemporaryAccount(Base):
    __tablename__ = "temp_accounts"

    id = Column(Integer, primary_key=True, index=True)
    temp_id = Column(String, unique=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    reason_for_temp = Column(String, nullable=True)   # "Emergency", "Forgot ID", "Guest"
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    from_hospital = Column(String, nullable=True)
    to_hospital = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
    fhir_bundle_json = Column(Text, nullable=True)
    status = Column(String, default="PENDING")        # PENDING / ACCEPTED / COMPLETED
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("PatientProfile", back_populates="referrals")
