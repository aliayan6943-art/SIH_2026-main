/**
 * MediKiosk — Typed API Client
 * Centralized fetch wrapper for all backend API calls.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PatientListItem {
  id: string;
  name: string;
  age?: number;
  gender?: string;
  abha_id?: string;
  language: string;
  is_ayush: boolean;
  status: string;
  is_emergency: boolean;
  chief_complaint: string;
  source: string;
  assigned_doctor: string;
  is_demo?: boolean;
}

export interface PatientDetail {
  patient_id: string;
  name?: string;
  age?: number;
  gender?: string;
  abha_id?: string;
  contact?: string;
  language: string;
  is_ayush: boolean;
  is_emergency: boolean;
  red_flags: string[];
  chief_complaint: string;
  raw_history: string;
  socrates: Record<string, string>;
  ayush: Record<string, string>;
  documents: { filename: string; extracted_data: string; uploaded_at?: string }[];
  prose_summary?: string;
  status: string;
  assigned_doctor?: string;
  is_demo?: boolean;
}

export interface PatientProfile {
  patient_id: string;
  name?: string;
  age?: number;
  gender?: string;
  abha_id?: string;
  contact?: string;
  language: string;
  is_ayush: boolean;
  chief_complaint?: string;
  socrates?: Record<string, string>;
  ayush?: Record<string, string>;
  documents?: { filename: string; extracted_data: string }[];
  red_flags?: string[];
  assigned_doctor?: string;
  status?: string;
  patient_summary?: string;
  visits?: Array<{ date: string; doctor: string; department: string; status: string; chief_complaint: string }>;
  is_demo?: boolean;
}

export interface Doctor {
  id: string;
  name: string;
  department: string;
  speciality: string;
  is_available: boolean;
  patients_today: number;
}

export interface ChatResponse {
  status: 'OK' | 'EMERGENCY_ALERT' | 'ERROR' | 'SUCCESS';
  message?: string;
  transcription?: string;
  summary_ready?: boolean;
  red_flags?: string[];
  turn_count?: number;
  error?: string;
}

export interface AuthResponse {
  status: 'SUCCESS' | 'ERROR';
  patient: {
    id: string;
    name: string;
    abha_id?: string;
    age?: number;
    gender?: string;
    contact?: string;
  };
  visit_id: number;
  is_guest?: boolean;
}

export interface AnalyticsData {
  total_patients_today: number;
  emergencies: number;
  summary_ready: number;
  in_session: number;
  ayush_patients: number;
  avg_session_minutes: number;
  doctors_available: number;
  languages: Record<string, number>;
  hourly_flow: { hour: string; patients: number }[];
  top_complaints: { complaint: string; count: number }[];
}

// ─── API Functions ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API ${path} failed: ${res.status} — ${error}`);
  }
  return res.json() as Promise<T>;
}

// Auth
export const authAbha = (abha_id: string) =>
  apiFetch<AuthResponse>('/api/auth/abha', {
    method: 'POST',
    body: JSON.stringify({ abha_id }),
  });

export const authGuest = (name: string, age: number, gender: string, contact?: string) =>
  apiFetch<AuthResponse>('/api/auth/guest', {
    method: 'POST',
    body: JSON.stringify({ name, age, gender, contact }),
  });

// Chat
export const sendChatMessage = (patient_id: string, message: string, language: string, is_ayush: boolean) =>
  apiFetch<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ patient_id, message, language, is_ayush }),
  });

export const sendAudioMessage = async (
  patient_id: string,
  audioBlob: Blob,
  language: string,
  is_ayush: boolean
): Promise<ChatResponse> => {
  const formData = new FormData();
  formData.append('patient_id', patient_id);
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('language', language);
  formData.append('is_ayush', String(is_ayush));
  const res = await fetch(`${API_BASE}/api/chat/audio`, { method: 'POST', body: formData });
  return res.json();
};

export const uploadDocument = async (patient_id: string, file: File) => {
  const formData = new FormData();
  formData.append('patient_id', patient_id);
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
  return res.json();
};

export const completeSession = (patient_id: string, visit_id: number, language: string) =>
  apiFetch<{ status: string; prose_preview?: string }>('/api/session/complete', {
    method: 'POST',
    body: JSON.stringify({ patient_id, visit_id, language }),
  });

// Patients
export const listPatients = () =>
  apiFetch<{ patients: PatientListItem[]; total: number }>('/api/patients');

export const getPatient = (id: string) =>
  apiFetch<PatientDetail>(`/api/patients/${id}`);

export const getPatientProseSummary = (id: string) =>
  apiFetch<{ patient_id: string; prose_summary: string; cached: boolean }>(`/api/patients/${id}/prose-summary`);

export const getPatientProfile = (id: string) =>
  apiFetch<PatientProfile>(`/api/profile/${id}`);

// Doctors
export const listDoctors = () =>
  apiFetch<{ doctors: Doctor[] }>('/api/doctors');

export const assignDoctor = (patient_id: string, doctor_id: string) =>
  apiFetch<{ status: string }>('/api/doctors/assign', {
    method: 'POST',
    body: JSON.stringify({ patient_id, doctor_id }),
  });

// Analytics
export const getAnalytics = () =>
  apiFetch<AnalyticsData>('/api/analytics/overview');

// TTS URL helper
export const getTTSUrl = (text: string, language: string) =>
  `${API_BASE}/api/tts?text=${encodeURIComponent(text)}&language=${language}`;

export const playTTS = (text: string, language: string): HTMLAudioElement => {
  const audio = new Audio(getTTSUrl(text, language));
  audio.play().catch(e => console.warn('[TTS] Playback error:', e));
  return audio;
};
