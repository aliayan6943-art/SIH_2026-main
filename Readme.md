# MediKiosk - AI Clinical History Platform

## Overview

MediKiosk is an AI-powered Clinical History Platform tailored for Indian Public Hospitals. The system serves as a self-service or assisted kiosk that interacts with patients to gather their detailed medical history before they meet the doctor. By leveraging conversational AI (text and voice), document OCR, and standardized frameworks (SOCRATES for Allopathy, Dashavidha Pariksha for AYUSH), MediKiosk aims to reduce doctor workload, streamline patient triage, and ensure high-quality clinical data collection.

## Key Features

- **Multilingual Conversational Agent**: AI-driven chat and voice interface designed to capture patient history naturally.
- **Voice-to-Text & Text-to-Speech (Indic Languages)**: Integrated with Bhashini and edge-tts to allow patients to speak in their native languages instead of typing.
- **Intelligent Document OCR**: Patients can upload prior prescriptions or lab reports. The system uses Vision AI to extract key medical data (diagnoses, medications, lab values).
- **Structured Clinical Summaries**: Automatically generates comprehensive summaries in standard medical formats for the doctor's review.
- **Emergency Triage Alerts**: The AI engine actively detects "red flags" (e.g., thunderclap headaches, severe chest pain) during conversation and triggers emergency triage protocols.
- **ABHA ID Integration**: Seamless identity verification and patient profile retrieval.
- **Dual Support (Allopathic & AYUSH)**: Adaptive history taking depending on the selected medical discipline.
- **Role-based Dashboards**: Specific frontend views tailored for Kiosk terminals, Reception/Triage staff, and Doctors.

## Technology Stack

### Backend
- **Framework**: FastAPI (Python)
- **AI & LLMs**: LangChain, LangGraph, Groq (Llama-3 models)
- **Vision OCR**: Groq Vision (`llama-3.2-11b-vision-preview`)
- **Database**: PostgreSQL (via NeonDB) / SQLite with SQLAlchemy ORM
- **Speech Services**: Bhashini API (Indic ASR/TTS), edge-tts

### Frontend
- **Framework**: Next.js 16 (App Router), React 19
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn UI, Base UI, Lucide-react
- **Animations & Visualization**: Framer Motion, Recharts

## Project Structure

```text
SIH_2026-main/
├── backend/                  # FastAPI Application
│   ├── engine/               # Conversational Engine (LangGraph), Summarizer, Bhashini Client
│   ├── main.py               # API Endpoints (Chat, OCR, Auth, Patient/Doctor Routes)
│   ├── database.py           # SQLAlchemy Database Configuration
│   ├── models.py             # Database Models (PatientProfile, Visit, ClinicalSummary)
│   ├── requirements.txt      # Python Dependencies
│   └── tests/                # Unit Tests (test_api, test_llm, test_tts)
│
├── frontend/                 # Next.js Application
│   ├── src/                  # React Components, Pages, and Hooks
│   ├── public/               # Static Assets
│   ├── package.json          # Node Dependencies
│   ├── tailwind.config.js    # Tailwind Settings
│   └── components.json       # Shadcn UI Configuration
│
└── Readme.md                 # Project Documentation
```

## Architecture Modules

1. **Module A — Conversational History Engine**: Handles stateful multi-turn interactions (`/api/chat`, `/api/chat/audio`, `/api/tts`).
2. **Module B — Document Digitisation & OCR**: Processes uploaded images to extract medical text (`/api/upload`).
3. **Module C — Clinical Summary Generator**: Compiles collected data into structured formats (`/api/patients/*`).
4. **Module D — Identity & Persistence**: Manages ABHA ID auth, guest auth, and patient sessions (`/api/auth/*`).
5. **Module E — Doctor & Reception APIs**: Feeds data to the hospital dashboards (`/api/doctors`).

## Getting Started

### Prerequisites
- Python 3.9+
- Node.js (v18+) & npm/pnpm
- Groq API Key
- Bhashini Credentials (for Indic language support)

### 1. Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment
python -m venv venv
# On Windows: venv\Scripts\activate
# On Mac/Linux: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create a .env file and add necessary API keys
echo "GROQ_API_KEY=your_groq_api_key_here" > .env

# Start the FastAPI development server
uvicorn main:app --reload --port 8000
```
The backend API documentation will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

### 2. Frontend Setup

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the Next.js development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

## Contribution & Development
When contributing to this project, ensure that:
- Any new backend APIs are documented and integrated into `main.py`.
- New UI components are placed in `frontend/src/components` and use Tailwind/Shadcn for consistent styling.
- The conversational engine's state and prompts (`backend/engine/`) are carefully tested when modified to prevent AI hallucinations.
