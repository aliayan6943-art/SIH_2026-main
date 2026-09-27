"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Send, AlertTriangle, Stethoscope, Camera,
  Globe, Shield, ArrowLeft, X, FileText, Loader2, Volume2,
  VolumeX, CheckCircle2, User, Leaf, ChevronRight, Activity,
} from 'lucide-react';
import {
  authAbha, authGuest, sendChatMessage, sendAudioMessage,
  uploadDocument, completeSession, playTTS, ChatResponse, API_BASE,
} from '@/lib/api';
import { LANGUAGES, Language, OPD_MODES } from '@/lib/languages';

type KioskStep = 'welcome' | 'language' | 'auth' | 'mode' | 'chat' | 'upload' | 'done';

interface Message {
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface PatientInfo {
  id: string;
  name: string;
  visitId: number;
  isGuest: boolean;
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          <div className={`flex items-center gap-1.5 transition-all duration-300 ${i <= current ? 'opacity-100' : 'opacity-35'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
              i < current ? 'bg-indigo-600 border-indigo-600 text-white' :
              i === current ? 'bg-white border-indigo-600 text-indigo-600' :
              'border-slate-300 text-slate-400 bg-white'
            }`}>
              {i < current ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === current ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-4 transition-all ${i < current ? 'bg-indigo-500' : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Mic Button ───────────────────────────────────────────────────────────────

function MicButton({ isRecording, onStart, onStop, disabled }: {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative flex items-center justify-center">
        {isRecording && (
          <>
            <span className="absolute w-20 h-20 rounded-full bg-rose-100 animate-ping opacity-70" />
            <span className="absolute w-28 h-28 rounded-full bg-rose-50 animate-ping opacity-40" style={{ animationDelay: '0.2s' }} />
          </>
        )}
        <button
          onMouseDown={onStart}
          onMouseUp={onStop}
          onTouchStart={e => { e.preventDefault(); onStart(); }}
          onTouchEnd={e => { e.preventDefault(); onStop(); }}
          disabled={disabled}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow transition-all duration-200 select-none disabled:opacity-40 ${
            isRecording
              ? 'bg-rose-500 scale-110 shadow-rose-200 shadow-md'
              : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105 shadow-indigo-100 shadow-md'
          }`}
        >
          {isRecording
            ? <MicOff size={22} className="text-white" />
            : <Mic size={22} className="text-white" />
          }
        </button>
      </div>
      <p className={`text-xs font-medium ${isRecording ? 'text-rose-600' : 'text-slate-400'}`}>
        {isRecording ? '● Listening… release to send' : 'Hold to speak'}
      </p>
    </div>
  );
}

// ─── Emergency Overlay ────────────────────────────────────────────────────────

function EmergencyOverlay({ redFlags }: { redFlags: string[] }) {
  useEffect(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(); osc.stop(ctx.currentTime + 0.8);
    } catch { /* ignore */ }
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-red-50 p-8">
      <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
        className="w-24 h-24 rounded-full bg-red-100 border-4 border-red-400 flex items-center justify-center mb-8">
        <AlertTriangle size={52} className="text-red-600" />
      </motion.div>
      <h1 className="text-4xl font-black mb-2 text-red-700">MEDICAL EMERGENCY</h1>
      <p className="text-red-500 text-lg mb-8">Staff have been alerted. Please stay calm.</p>
      {redFlags.length > 0 && (
        <div className="bg-white border border-red-200 rounded-2xl p-5 max-w-md w-full mb-8 shadow-sm">
          <p className="text-xs font-bold text-red-500 uppercase tracking-wide mb-2">Detected Flags</p>
          {redFlags.map((f, i) => (
            <p key={i} className="text-red-700 font-medium text-sm">• {f}</p>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 max-w-md w-full">
        {['Stay Calm', 'Do Not Move', 'Help Coming'].map(l => (
          <div key={l} className="bg-red-100 border border-red-200 rounded-xl p-3 text-center">
            <p className="text-red-700 text-sm font-semibold">{l}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Input field ──────────────────────────────────────────────────────────────

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className={`w-full border border-slate-300 rounded-xl py-3.5 px-4 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition bg-white ${props.className ?? ''}`}
    />
  );
}

// ─── Main Kiosk ──────────────────────────────────────────────────────────────

export default function PatientKiosk() {
  const [step, setStep] = useState<KioskStep>('welcome');
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [language, setLanguage] = useState<Language>(LANGUAGES[0]);
  const [isAyush, setIsAyush] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isEmergency, setIsEmergency] = useState(false);
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [summaryReady, setSummaryReady] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [greetingLoaded, setGreetingLoaded] = useState(false);

  const [authMode, setAuthMode] = useState<'abha' | 'guest'>('abha');
  const [abhaId, setAbhaId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestAge, setGuestAge] = useState('');
  const [guestGender, setGuestGender] = useState('');
  const [guestContact, setGuestContact] = useState('');

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const speak = useCallback((text: string) => {
    if (!isMuted) playTTS(text, language.code);
  }, [isMuted, language.code]);

  // ── Auto-greeting: AI speaks first when chat starts ──────────────────────
  useEffect(() => {
    if (step === 'chat' && patient && !greetingLoaded && messages.length === 0) {
      setGreetingLoaded(true);
      const fetchGreeting = async () => {
        try {
          const res = await fetch(
            `${API_BASE}/api/chat/greet?patient_id=${patient.id}&language=${language.code}&is_ayush=${isAyush}`
          );
          const data = await res.json();
          if (data.message) {
            setMessages([{ role: 'ai', content: data.message, timestamp: new Date() }]);
            speak(data.message);
          }
        } catch { /* fallback greeting */ 
          setMessages([{ role: 'ai', content: 'Hello! Please describe your symptoms.', timestamp: new Date() }]);
        }
      };
      fetchGreeting();
    }
  }, [step, patient, greetingLoaded, messages.length, language.code, isAyush, speak]);

  // ── Auth ──────────────────────────────────────────────────────────────────

  const handleAbhaAuth = async () => {
    if (!abhaId.trim()) return;
    setIsLoading(true);
    try {
      const data = await authAbha(abhaId.trim());
      if (data.status === 'SUCCESS') {
        setPatient({ id: data.patient.id, name: data.patient.name, visitId: data.visit_id, isGuest: false });
        setStep('mode');
      }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const handleGuestAuth = async () => {
    if (!guestName.trim() || !guestAge || !guestGender) return;
    setIsLoading(true);
    try {
      const data = await authGuest(guestName.trim(), parseInt(guestAge), guestGender, guestContact || undefined);
      if (data.status === 'SUCCESS') {
        setPatient({ id: data.patient.id, name: data.patient.name, visitId: data.visit_id, isGuest: true });
        setStep('mode');
      }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  // ── Chat ──────────────────────────────────────────────────────────────────

  const handleChatResponse = useCallback((data: ChatResponse) => {
    if (data.status === 'EMERGENCY_ALERT') {
      setRedFlags(data.red_flags || []);
      setIsEmergency(true);
      return;
    }
    if (data.message) {
      setMessages(prev => [...prev, { role: 'ai', content: data.message!, timestamp: new Date() }]);
      speak(data.message);
    }
    if (data.summary_ready) {
      setSummaryReady(true);
      setTimeout(() => setStep('upload'), 3000);
    }
  }, [speak]);

  const sendMessage = async () => {
    if (!inputText.trim() || !patient || isLoading) return;
    const text = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date() }]);
    setIsLoading(true);
    try {
      const data = await sendChatMessage(patient.id, text, language.code, isAyush);
      handleChatResponse(data);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: 'Connection error. Please try again.', timestamp: new Date() }]);
    }
    setIsLoading(false);
  };

  const startRecording = async () => {
    if (isLoading || isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (!patient) return;
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setIsLoading(true);
        try {
          const data = await sendAudioMessage(patient.id, blob, language.code, isAyush);
          if (data.transcription) {
            setMessages(prev => [...prev, { role: 'user', content: data.transcription!, timestamp: new Date() }]);
          }
          handleChatResponse(data);
        } catch { /* silent */ }
        setIsLoading(false);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch { console.error('Mic denied'); }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleFileUpload = async (file: File) => {
    if (!patient) return;
    setIsLoading(true);
    try {
      const data = await uploadDocument(patient.id, file);
      if (data.status === 'SUCCESS') setUploadedDocs(prev => [...prev, file.name]);
    } catch { /* silent */ }
    setIsLoading(false);
  };

  const handleComplete = async () => {
    if (!patient) return;
    setIsLoading(true);
    try {
      await completeSession(patient.id, patient.visitId, language.code);
      setStep('done');
    } catch { }
    setIsLoading(false);
  };

  const resetKiosk = () => {
    setStep('welcome'); setPatient(null); setLanguage(LANGUAGES[0]);
    setIsAyush(false); setMessages([]); setIsEmergency(false);
    setRedFlags([]); setSummaryReady(false); setUploadedDocs([]);
    setAbhaId(''); setGuestName(''); setGuestAge('');
    setGuestGender(''); setGuestContact(''); setInputText('');
    setGreetingLoaded(false);
  };

  if (isEmergency) return <EmergencyOverlay redFlags={redFlags} />;

  const STEPS = ['Language', 'Verify', 'Mode', 'History', 'Records'];
  const currentStepIndex = ['language', 'auth', 'mode', 'chat', 'upload'].indexOf(step);

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;600&display=swap');`}</style>

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between sticky top-0 z-40">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 select-none">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Activity size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-slate-900 font-bold text-base tracking-tight">
              Medi<span className="text-indigo-600">Kiosk</span>
            </span>
          </div>
          <span className="hidden sm:block text-slate-300 text-xs pl-2 border-l border-slate-200">AI Clinical Platform</span>
        </div>

        {step !== 'welcome' && step !== 'done' && (
          <StepIndicator current={currentStepIndex} steps={STEPS} />
        )}

        <div className="flex items-center gap-2">
          <button onClick={() => setIsMuted(m => !m)}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
            title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          {step !== 'welcome' && (
            <button onClick={resetKiosk}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition text-xs font-medium">
              <X size={12} /> End Session
            </button>
          )}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 flex items-center justify-center p-5">
        <AnimatePresence mode="wait">

          {/* ══ WELCOME ══ */}
          {step === 'welcome' && (
            <motion.div key="welcome"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="text-center max-w-xl w-full">

              <div className="w-20 h-20 mx-auto mb-7 rounded-[22px] bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-200">
                <Stethoscope size={38} className="text-white" strokeWidth={1.8} />
              </div>

              <h2 className="text-4xl font-extrabold text-slate-900 mb-3 tracking-tight leading-tight">
                Patient History<br /><span className="text-indigo-600">Kiosk</span>
              </h2>
              <p className="text-slate-500 text-base mb-9 leading-relaxed max-w-sm mx-auto">
                Speak or type your symptoms in your own language. Our AI will prepare your medical history for the doctor.
              </p>

              <div className="flex flex-wrap justify-center gap-2 mb-9">
                {['हिंदी', 'English', 'தமிழ்', 'తెలుగు', 'मराठी'].map(lang => (
                  <span key={lang} className="px-3.5 py-1.5 rounded-full border border-indigo-100 bg-indigo-50 text-indigo-700 text-sm font-medium">
                    {lang}
                  </span>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-7">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setStep('language')}
                  className="px-9 py-4 bg-indigo-600 rounded-xl text-white font-semibold text-base shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all">
                  Begin Registration →
                </motion.button>
                <button
                  onClick={() => { setStep('chat'); setPatient({ id: `EMRG-${Date.now()}`, name: 'Emergency Patient', visitId: 0, isGuest: true }); }}
                  className="px-7 py-4 bg-white border-2 border-red-200 rounded-xl text-red-600 font-semibold text-sm hover:bg-red-50 transition">
                  🚨 Emergency — Skip Registration
                </button>
              </div>

              <p className="text-slate-400 text-xs flex items-center justify-center gap-1.5">
                <Shield size={11} className="text-indigo-400" />
                ABDM Compliant · DPDPA 2023 · Ministry of Health & Family Welfare
              </p>
            </motion.div>
          )}

          {/* ══ LANGUAGE ══ */}
          {step === 'language' && (
            <motion.div key="language"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="w-full max-w-xl">
              <div className="text-center mb-7">
                <div className="w-11 h-11 mx-auto mb-4 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Globe size={20} className="text-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">Select Your Language</h2>
                <p className="text-slate-500 text-sm">अपनी भाषा चुनें • Choose your language</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {LANGUAGES.map(lang => (
                  <motion.button key={lang.code} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                    onClick={() => { setLanguage(lang); speak(lang.greeting); setStep('auth'); }}
                    className={`relative p-5 rounded-2xl border-2 text-left transition-all bg-white ${
                      language.code === lang.code
                        ? 'border-indigo-500 shadow-sm shadow-indigo-100'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }`}>
                    <div className="text-3xl mb-2">{lang.flag}</div>
                    <p className="text-slate-900 font-bold text-lg leading-tight">{lang.nativeName}</p>
                    <p className="text-slate-500 text-sm">{lang.name}</p>
                    {language.code === lang.code && (
                      <CheckCircle2 size={16} className="absolute top-4 right-4 text-indigo-500" />
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ══ AUTH ══ */}
          {step === 'auth' && (
            <motion.div key="auth"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="w-full max-w-sm">
              <button onClick={() => setStep('language')}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm mb-5 transition">
                <ArrowLeft size={14} /> Back
              </button>

              <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900 mb-1">Verify Identity</h2>
                <p className="text-slate-400 text-xs mb-5 flex items-center gap-1">
                  <Shield size={11} className="text-indigo-400" /> Secured under DPDPA 2023
                </p>

                <div className="flex p-1 bg-slate-100 rounded-xl mb-5">
                  {(['abha', 'guest'] as const).map(mode => (
                    <button key={mode} onClick={() => setAuthMode(mode)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
                        authMode === mode ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}>
                      {mode === 'abha' ? '🪪 ABHA ID' : '👤 Guest'}
                    </button>
                  ))}
                </div>

                {authMode === 'abha' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-slate-700 text-xs font-semibold block mb-1.5">ABHA Health ID</label>
                      <input type="text" value={abhaId} onChange={e => setAbhaId(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAbhaAuth()}
                        placeholder="91-XXXX-XXXX-XXXX"
                        className="w-full border border-slate-300 rounded-xl py-3 px-4 text-slate-900 text-center tracking-widest text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition bg-white" />
                    </div>
                    <button disabled={isLoading || !abhaId.trim()} onClick={handleAbhaAuth}
                      className="w-full py-3 bg-indigo-600 rounded-xl text-white font-semibold text-sm disabled:opacity-50 hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                      {isLoading ? <Loader2 size={16} className="animate-spin" /> : <><span>Verify & Continue</span><ChevronRight size={14} /></>}
                    </button>
                    <p className="text-center text-slate-400 text-[11px]">Demo: 91-1234-5678-0001</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <Input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Full Name" />
                    <div className="grid grid-cols-2 gap-2.5">
                      <Input type="number" value={guestAge} onChange={e => setGuestAge(e.target.value)} placeholder="Age" />
                      <select value={guestGender} onChange={e => setGuestGender(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl py-3.5 px-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition bg-white">
                        <option value="">Gender</option>
                        <option>Male</option><option>Female</option><option>Other</option>
                      </select>
                    </div>
                    <Input type="tel" value={guestContact} onChange={e => setGuestContact(e.target.value)} placeholder="Mobile (optional)" />
                    <button disabled={isLoading || !guestName.trim() || !guestAge || !guestGender}
                      onClick={handleGuestAuth}
                      className="w-full py-3 bg-indigo-600 rounded-xl text-white font-semibold text-sm disabled:opacity-50 hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                      {isLoading ? <Loader2 size={16} className="animate-spin" /> : <><span>Register & Continue</span><ChevronRight size={14} /></>}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ══ MODE ══ */}
          {step === 'mode' && (
            <motion.div key="mode"
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="w-full max-w-xl text-center">
              <h2 className="text-2xl font-bold text-slate-900 mb-1">
                Welcome, <span className="text-indigo-600">{patient?.name}</span>
              </h2>
              <p className="text-slate-500 text-sm mb-8">Please select your consultation type to continue</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <motion.button whileHover={{ scale: 1.01, y: -2 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { setIsAyush(false); setStep('chat'); }}
                  className="p-7 rounded-2xl border-2 border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-50 transition-all text-left shadow-sm">
                  <div className="text-4xl mb-4">🏥</div>
                  <h3 className="text-slate-900 font-bold text-lg mb-1">{OPD_MODES.allopathic.label}</h3>
                  <p className="text-slate-500 text-xs mb-3 leading-relaxed">{OPD_MODES.allopathic.sublabel}</p>
                  <span className="text-[11px] text-indigo-600 font-bold bg-indigo-50 px-2.5 py-1 rounded-full">SOCRATES Assessment</span>
                </motion.button>

                <motion.button whileHover={{ scale: 1.01, y: -2 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { setIsAyush(true); setStep('chat'); }}
                  className="p-7 rounded-2xl border-2 border-slate-200 bg-white hover:border-amber-300 hover:shadow-md hover:shadow-amber-50 transition-all text-left shadow-sm">
                  <div className="text-4xl mb-4">🌿</div>
                  <h3 className="text-slate-900 font-bold text-lg mb-1">{OPD_MODES.ayush.label}</h3>
                  <p className="text-slate-500 text-xs mb-3 leading-relaxed">{OPD_MODES.ayush.sublabel}</p>
                  <span className="text-[11px] text-amber-700 font-bold bg-amber-50 px-2.5 py-1 rounded-full">Dashavidha Pariksha</span>
                </motion.button>
              </div>

              <p className="text-slate-400 text-xs mt-7">Ministry of Health & Family Welfare · Ministry of AYUSH</p>
            </motion.div>
          )}

          {/* ══ CHAT ══ */}
          {step === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="w-full max-w-2xl flex flex-col" style={{ height: 'calc(100vh - 128px)' }}>

              {/* Chat header */}
              <div className="flex items-center justify-between mb-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isAyush ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                    {isAyush
                      ? <Leaf size={15} className="text-amber-600" />
                      : <Stethoscope size={15} className="text-indigo-600" />}
                  </div>
                  <div>
                    <p className="text-slate-900 font-semibold text-sm leading-tight">{isAyush ? 'AYUSH Assessment' : 'Clinical History'}</p>
                    <p className="text-slate-400 text-xs">{patient?.name} · {language.nativeName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-emerald-600 text-xs font-medium">Live Session</span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-0.5">
                {messages.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'ai' && (
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                        <Activity size={13} className="text-indigo-600" />
                      </div>
                    )}
                    <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center mr-2 flex-shrink-0">
                      <Activity size={13} className="text-indigo-600" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 shadow-sm">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex-shrink-0">
                {/* Single mic only */}
                <div className="flex items-center justify-center mb-4">
                  <MicButton
                    isRecording={isRecording}
                    onStart={startRecording}
                    onStop={stopRecording}
                    disabled={isLoading}
                  />
                </div>

                <div className="flex items-center gap-1.5 text-slate-300 text-xs mb-3">
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-slate-400">or type below</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                <div className="flex gap-2">
                  <input
                    type="text" value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder={language.placeholder}
                    disabled={isLoading}
                    className="flex-1 border border-slate-300 rounded-xl py-2.5 px-4 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition disabled:opacity-50 bg-white"
                  />
                  <button onClick={sendMessage} disabled={!inputText.trim() || isLoading}
                    className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white disabled:opacity-40 hover:bg-indigo-700 transition flex-shrink-0">
                    <Send size={16} />
                  </button>
                </div>

                {summaryReady && (
                  <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    onClick={() => setStep('upload')}
                    className="w-full mt-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-semibold text-xs hover:bg-emerald-100 transition flex items-center justify-center gap-2">
                    <CheckCircle2 size={14} /> History complete — Upload documents →
                  </motion.button>
                )}

                <button onClick={() => setStep('upload')}
                  className="w-full mt-2.5 text-slate-400 text-[11px] hover:text-slate-600 transition">
                  Skip to document upload →
                </button>
              </div>
            </motion.div>
          )}

          {/* ══ UPLOAD ══ */}
          {step === 'upload' && (
            <motion.div key="upload"
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-teal-100 flex items-center justify-center">
                <FileText size={22} className="text-teal-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Upload Medical Records</h2>
              <p className="text-slate-500 text-sm mb-7 leading-relaxed">
                Prescriptions, lab reports or discharge summaries.<br />
                <span className="text-slate-400 text-xs">AI extracts diagnoses & medications automatically.</span>
              </p>

              <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} />

              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}
                onClick={() => fileInputRef.current?.click()} disabled={isLoading}
                className="w-full h-40 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center bg-white hover:border-indigo-400 hover:bg-indigo-50 transition cursor-pointer mb-5 shadow-sm">
                {isLoading
                  ? <><Loader2 size={30} className="text-indigo-600 animate-spin mb-2" /><p className="text-slate-500 text-sm">Analyzing…</p></>
                  : <><Camera size={30} className="text-slate-400 mb-2" /><p className="text-slate-700 font-semibold text-sm">Tap to select photo or file</p><p className="text-slate-400 text-xs mt-1">JPG, PNG, PDF supported</p></>
                }
              </motion.button>

              {uploadedDocs.length > 0 && (
                <div className="mb-5 space-y-2">
                  {uploadedDocs.map((doc, i) => (
                    <div key={i} className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span className="text-emerald-800 text-sm font-medium truncate">{doc}</span>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={handleComplete} disabled={isLoading}
                className="w-full py-3.5 bg-indigo-600 rounded-xl text-white font-semibold disabled:opacity-50 hover:bg-indigo-700 transition flex items-center justify-center gap-2 mb-3 shadow-sm">
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <><span>Finish & Send to Doctor</span><ChevronRight size={16} /></>}
              </button>
              <button onClick={() => setStep('chat')} className="text-slate-400 text-xs hover:text-slate-600 transition">
                ← Back to conversation
              </button>
            </motion.div>
          )}

          {/* ══ DONE ══ */}
          {step === 'done' && (
            <motion.div key="done"
              initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-sm text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220 }}
                className="w-20 h-20 mx-auto mb-7 rounded-full bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center">
                <CheckCircle2 size={44} className="text-emerald-600" />
              </motion.div>

              <h2 className="text-3xl font-extrabold text-slate-900 mb-2">All Done!</h2>
              <p className="text-slate-500 text-sm mb-7 leading-relaxed max-w-xs mx-auto">
                Your information has been sent to the doctor. Please wait — you will be called shortly.
              </p>

              {patient && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-7 text-left shadow-sm">
                  <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-3">Session Summary</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 text-sm">
                      <User size={13} className="text-indigo-500 flex-shrink-0" />
                      <span className="text-slate-800 font-medium">{patient.name}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm">
                      <Stethoscope size={13} className="text-indigo-500 flex-shrink-0" />
                      <span className="text-slate-600">{isAyush ? 'AYUSH OPD' : 'General OPD'} · {language.name}</span>
                    </div>
                    {uploadedDocs.length > 0 && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <FileText size={13} className="text-indigo-500 flex-shrink-0" />
                        <span className="text-slate-600">{uploadedDocs.length} document{uploadedDocs.length > 1 ? 's' : ''} scanned</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button onClick={resetKiosk}
                className="w-full py-3.5 border-2 border-slate-200 rounded-xl text-slate-700 font-semibold hover:bg-slate-100 transition text-sm">
                Start New Session
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
