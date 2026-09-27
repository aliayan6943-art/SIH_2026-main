"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  FileText, Share2, CheckCircle, Edit3, AlertTriangle,
  User, Phone, CreditCard, Stethoscope, ClipboardList,
  Activity, FlaskConical, ChevronLeft, Clock, Leaf,
  Brain, Flame, Wind, Heart, Loader2, ExternalLink,
  RefreshCw, Download,
} from "lucide-react";
import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { SidebarInset as SI } from "@/components/ui/sidebar";
import {
  listPatients, getPatient, getPatientProseSummary,
  listDoctors, assignDoctor, PatientListItem, PatientDetail, Doctor,
} from "@/lib/api";
import { LANGUAGE_MAP, STATUS_CONFIG } from "@/lib/languages";
import { motion, AnimatePresence } from "framer-motion";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitial(name?: string) {
  return name?.trim().charAt(0).toUpperCase() || "?";
}

function StatusPill({ status, isEmergency }: { status: string; isEmergency: boolean }) {
  const key = isEmergency ? "EMERGENCY" : status;
  const cfg = STATUS_CONFIG[key] || STATUS_CONFIG["Waiting"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} ${isEmergency ? "animate-pulse" : ""}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function SocratesCard({ socrates }: { socrates: Record<string, string> }) {
  const icons: Record<string, React.ElementType> = {
    Site: ClipboardList, Onset: Clock, Character: Activity,
    Radiation: Wind, Associated: Stethoscope, TimeCourse: Clock,
    Exacerbating: Flame, Severity: Heart,
  };
  const entries = Object.entries(socrates).filter(([, v]) => v && v !== "Not reported");
  if (!entries.length) return <p className="text-slate-400 italic text-sm">No SOCRATES data collected.</p>;

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {entries.map(([key, val]) => {
        const Icon = icons[key] || Activity;
        return (
          <div key={key} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={12} className="text-indigo-500" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{key}</span>
            </div>
            <p className="text-sm text-slate-800 font-medium leading-snug">{val}</p>
          </div>
        );
      })}
    </div>
  );
}

function AyushCard({ ayush }: { ayush: Record<string, string> }) {
  const entries = Object.entries(ayush).filter(([, v]) => v && v !== "Not collected");
  if (!entries.length) return <p className="text-slate-400 italic text-sm">No AYUSH data collected.</p>;
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {entries.map(([key, val]) => (
        <div key={key} className="bg-amber-50 border border-amber-100 rounded-xl p-3">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">{key}</p>
          <p className="text-sm text-amber-900 font-medium leading-snug">{val}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function DoctorDashboardContent() {
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [patientData, setPatientData] = useState<PatientDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [proseSummary, setProseSummary] = useState<string>("");
  const [proseSummaryLoading, setProseSummaryLoading] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const searchParams = useSearchParams();

  const fetchPatients = useCallback(async () => {
    try {
      const data = await listPatients();
      const list = data.patients || [];
      setPatients(list);
      setLastUpdated(new Date());

      const urlId = searchParams.get("patientId");
      if (urlId && !selectedId) {
        setSelectedId(urlId);
      } else if (!selectedId && list.length > 0) {
        const emerg = list.find(p => p.is_emergency);
        setSelectedId(emerg ? emerg.id : list[0].id);
      }
    } catch (e) { console.error(e); }
  }, [searchParams, selectedId]);

  useEffect(() => {
    fetchPatients();
    listDoctors().then(d => setDoctors(d.doctors || []));
    const interval = setInterval(fetchPatients, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setProseSummary("");
    getPatient(selectedId)
      .then(data => { setPatientData(data); return data; })
      .then(data => {
        // Load prose summary
        if (data.prose_summary) {
          setProseSummary(data.prose_summary);
        } else {
          setProseSummaryLoading(true);
          getPatientProseSummary(selectedId)
            .then(r => setProseSummary(r.prose_summary))
            .catch(() => {})
            .finally(() => setProseSummaryLoading(false));
        }
      })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const emergencies = patients.filter(p => p.is_emergency);
  const lang = patientData?.language ? LANGUAGE_MAP[patientData.language] : null;

  return (
    <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 h-[calc(100vh-var(--header-height))] overflow-hidden bg-slate-50">

          {/* ── Left Panel: Patient Queue ── */}
          <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-white">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-bold text-slate-800 text-sm">Patient Queue</h2>
                <button
                  onClick={fetchPatients}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                  title="Refresh"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
              <p className="text-xs text-slate-400">{patients.length} patients · Updated {lastUpdated.toLocaleTimeString()}</p>
            </div>

            {/* Emergency alerts at top */}
            {emergencies.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left px-4 py-3 bg-red-50 border-b border-red-100 hover:bg-red-100 transition ${selectedId === p.id ? "border-l-4 border-l-red-500" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-600 animate-pulse flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-red-700 truncate">{p.name}</p>
                    <p className="text-xs text-red-500 truncate">{p.chief_complaint}</p>
                  </div>
                </div>
              </button>
            ))}

            {/* Regular patients */}
            <div className="flex-1 overflow-y-auto">
              {patients.filter(p => !p.is_emergency).map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition ${
                    selectedId === p.id ? "bg-indigo-50 border-l-4 border-l-indigo-500" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      p.is_ayush ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
                    }`}>
                      {getInitial(p.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                        {p.is_ayush && <Leaf size={10} className="text-amber-600 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{p.chief_complaint || p.status}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <StatusPill status={p.status} isEmergency={p.is_emergency} />
                    </div>
                  </div>
                </button>
              ))}
              {patients.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm">No patients in queue</div>
              )}
            </div>
          </div>

          {/* ── Right Panel: Patient Detail ── */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="text-indigo-400 animate-spin" />
              </div>
            )}

            {!loading && !patientData && (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <ClipboardList size={40} className="mb-3 text-slate-300" />
                <p>Select a patient to view their clinical summary</p>
              </div>
            )}

            {!loading && patientData && (
              <div className="p-6 max-w-5xl">

                {/* ── Patient Header ── */}
                <div className="flex justify-between items-start mb-6 pb-5 border-b border-slate-200">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-sm ${
                      patientData.is_emergency ? "bg-red-100 text-red-700" :
                      patientData.is_ayush ? "bg-amber-100 text-amber-700" :
                      "bg-indigo-100 text-indigo-700"
                    }`}>
                      {getInitial(patientData.name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap mb-1">
                        <h1 className="text-2xl font-bold text-slate-900">{patientData.name || "Unknown Patient"}</h1>
                        {patientData.is_emergency && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold animate-pulse border border-red-200">EMERGENCY</span>
                        )}
                        {patientData.is_ayush && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold border border-amber-200 flex items-center gap-1">
                            <Leaf size={10} /> AYUSH
                          </span>
                        )}
                        {patientData.is_demo && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs font-medium border border-blue-200">Demo</span>
                        )}
                        {lang && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-medium border border-slate-200">{lang.nativeName}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                        {patientData.age && <span className="flex items-center gap-1"><User size={12} /> {patientData.age}y {patientData.gender === 'M' ? 'Male' : patientData.gender === 'F' ? 'Female' : patientData.gender}</span>}
                        {patientData.abha_id && <span className="flex items-center gap-1"><CreditCard size={12} /> ABHA: {patientData.abha_id}</span>}
                        {patientData.contact && <span className="flex items-center gap-1"><Phone size={12} /> {patientData.contact}</span>}
                        {patientData.assigned_doctor && <span className="flex items-center gap-1"><Stethoscope size={12} /> {patientData.assigned_doctor}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <a
                      href={`/profile/${patientData.patient_id}`}
                      target="_blank"
                      className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-medium hover:bg-slate-50 transition shadow-sm"
                    >
                      <ExternalLink size={13} /> Patient View
                    </a>
                    <button className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-medium hover:bg-slate-50 transition shadow-sm">
                      <Download size={13} /> FHIR
                    </button>
                    <button className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition shadow-sm">
                      <CheckCircle size={13} /> Finalize
                    </button>
                  </div>
                </div>

                {/* ── Emergency Red Flags ── */}
                {patientData.is_emergency && patientData.red_flags.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle size={18} className="text-red-600" />
                      <h3 className="font-bold text-red-700">Red Flags Detected — Immediate Review Required</h3>
                    </div>
                    <ul className="space-y-1.5">
                      {patientData.red_flags.map((flag, i) => (
                        <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ── AI Prose Summary ── */}
                <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-5 mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Brain size={16} className="text-indigo-600" />
                      <h3 className="font-semibold text-slate-800 text-sm">AI Clinical Summary</h3>
                      <span className="text-xs text-indigo-400 bg-indigo-100 px-2 py-0.5 rounded-full">Groq LLaMA-3</span>
                    </div>
                    <button className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition">
                      <Edit3 size={12} /> Edit
                    </button>
                  </div>
                  {proseSummaryLoading ? (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <Loader2 size={14} className="animate-spin" />
                      Generating clinical summary...
                    </div>
                  ) : proseSummary ? (
                    <p className="text-slate-700 text-sm leading-relaxed font-medium">{proseSummary}</p>
                  ) : (
                    <p className="text-slate-400 italic text-sm">Clinical summary will appear here after the AI completes the interview.</p>
                  )}
                </div>

                {/* ── SOCRATES + AYUSH Grid ── */}
                <div className="grid grid-cols-2 gap-5 mb-5">
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                      <ClipboardList size={15} className="text-indigo-600" />
                      <h3 className="font-semibold text-slate-800 text-sm">SOCRATES History</h3>
                    </div>
                    <div className="p-5">
                      <SocratesCard socrates={patientData.socrates || {}} />
                    </div>
                  </div>

                  <div className={`bg-white border rounded-2xl shadow-sm ${patientData.is_ayush ? "border-amber-200" : "border-slate-200"}`}>
                    <div className={`px-5 py-4 border-b flex items-center gap-2 ${patientData.is_ayush ? "border-amber-100 bg-amber-50/50" : "border-slate-100"}`}>
                      <Leaf size={15} className={patientData.is_ayush ? "text-amber-600" : "text-slate-400"} />
                      <h3 className="font-semibold text-slate-800 text-sm">AYUSH Dashavidha</h3>
                    </div>
                    <div className="p-5">
                      <AyushCard ayush={patientData.ayush || {}} />
                    </div>
                  </div>
                </div>

                {/* ── OCR Documents ── */}
                {patientData.documents?.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-5">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                      <FlaskConical size={15} className="text-teal-600" />
                      <h3 className="font-semibold text-slate-800 text-sm">Digitised Medical Documents</h3>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full ml-auto">
                        {patientData.documents.length} document{patientData.documents.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="p-5 space-y-4">
                      {patientData.documents.map((doc, i) => (
                        <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText size={14} className="text-teal-600" />
                            <span className="text-sm font-semibold text-slate-700">{doc.filename}</span>
                          </div>
                          <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{doc.extracted_data}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Raw Transcript ── */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-slate-500" />
                      <h3 className="font-semibold text-slate-800 text-sm">Kiosk Conversation Transcript</h3>
                    </div>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {patientData.language?.toUpperCase() || "EN"}
                    </span>
                  </div>
                  <div className="p-5">
                    {patientData.raw_history ? (
                      <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans leading-relaxed max-h-72 overflow-y-auto">
                        {patientData.raw_history}
                      </pre>
                    ) : (
                      <p className="text-slate-400 italic text-sm">No conversation recorded yet.</p>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function DoctorDashboard() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Dashboard...</div>}>
      <DoctorDashboardContent />
    </Suspense>
  );
}
