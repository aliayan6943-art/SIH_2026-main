"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  Users, AlertTriangle, Search, Stethoscope, CheckCircle,
  Clock, Activity, Phone, CreditCard, Plus, X, Loader2,
  RefreshCw, Leaf, ExternalLink, UserCheck,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { listPatients, listDoctors, PatientListItem, Doctor } from "@/lib/api";
import { LANGUAGE_MAP, STATUS_CONFIG } from "@/lib/languages";
import { motion, AnimatePresence } from "framer-motion";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  subtitle?: string;
}) {
  const colorMap: Record<string, { bg: string; icon: string; value: string }> = {
    blue:    { bg: "bg-blue-50 border-blue-100",    icon: "text-blue-600 bg-blue-100",   value: "text-blue-700" },
    green:   { bg: "bg-emerald-50 border-emerald-100", icon: "text-emerald-600 bg-emerald-100", value: "text-emerald-700" },
    red:     { bg: "bg-red-50 border-red-100",      icon: "text-red-600 bg-red-100",     value: "text-red-700" },
    indigo:  { bg: "bg-indigo-50 border-indigo-100", icon: "text-indigo-600 bg-indigo-100", value: "text-indigo-700" },
    amber:   { bg: "bg-amber-50 border-amber-100",  icon: "text-amber-600 bg-amber-100", value: "text-amber-700" },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className={`${c.bg} border rounded-2xl p-5 shadow-sm`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`${c.icon} p-2 rounded-xl`}>
          <Icon size={18} />
        </div>
        <span className="text-sm font-medium text-slate-600">{label}</span>
      </div>
      <p className={`text-3xl font-black ${c.value}`}>{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
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

// ─── New Patient Modal ─────────────────────────────────────────────────────────

function NewPatientModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900">Register New Patient</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <p className="text-slate-500 text-sm mb-6">
          Direct the patient to a MediKiosk terminal, or register them manually here.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => { window.open("/", "_blank"); onClose(); }}
            className="w-full flex items-center gap-3 p-4 border-2 border-indigo-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <ExternalLink size={18} className="text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Open Kiosk Terminal</p>
              <p className="text-xs text-slate-500">Patient self-registration on a new screen</p>
            </div>
          </button>
          <button
            onClick={onClose}
            className="w-full flex items-center gap-3 p-4 border-2 border-slate-200 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <UserCheck size={18} className="text-slate-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Manual Walk-in Entry</p>
              <p className="text-xs text-slate-500">Receptionist registers without kiosk</p>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Reception Dashboard ─────────────────────────────────────────────────

export default function ReceptionDashboard() {
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const router = useRouter();

  const fetchAll = useCallback(async () => {
    try {
      const [pData, dData] = await Promise.all([listPatients(), listDoctors()]);
      setPatients(pData.patients || []);
      setDoctors(dData.doctors || []);
      setLastUpdated(new Date());
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const filtered = patients.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.id?.toLowerCase().includes(search.toLowerCase()) ||
    p.abha_id?.toLowerCase().includes(search.toLowerCase()) ||
    p.chief_complaint?.toLowerCase().includes(search.toLowerCase())
  );

  const emergencies = filtered.filter(p => p.is_emergency);
  const summaryReady = patients.filter(p => p.status === "Summary Ready").length;
  const available = doctors.filter(d => d.is_available).length;
  const ayushCount = patients.filter(p => p.is_ayush).length;

  return (
    <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col p-6 gap-5 bg-slate-50 overflow-auto">

          {/* ── Stats Row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard icon={Users} label="Total Patients" value={patients.length} color="blue" subtitle="Today" />
            <StatCard icon={CheckCircle} label="Summary Ready" value={summaryReady} color="green" subtitle="For doctor" />
            <StatCard icon={AlertTriangle} label="Emergencies" value={emergencies.length} color="red" subtitle="Immediate review" />
            <StatCard icon={Stethoscope} label="Doctors Available" value={`${available}/${doctors.length}`} color="indigo" subtitle="On duty" />
            <StatCard icon={Leaf} label="AYUSH Patients" value={ayushCount} color="amber" subtitle="This session" />
          </div>

          {/* ── Emergency Banners ── */}
          <AnimatePresence>
            {emergencies.map(p => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-50 border-l-4 border-red-500 border border-red-200 p-4 rounded-xl shadow-sm flex justify-between items-center"
              >
                <div className="flex items-center gap-3 text-red-700">
                  <AlertTriangle size={20} className="animate-bounce flex-shrink-0" />
                  <div>
                    <p className="font-bold">{p.name} <span className="font-normal text-sm opacity-70">({p.id})</span></p>
                    <p className="text-sm font-normal opacity-80 mt-0.5">{p.chief_complaint}</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/doctor?patientId=${p.id}`)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition shadow-sm flex-shrink-0"
                >
                  View in EMR →
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* ── Main Content ── */}
          <div className="flex gap-5">

            {/* Patient Queue Table */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-slate-800">Live Patient Queue</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Auto-refreshes · Last updated {lastUpdated.toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex gap-3 items-center">
                  <button onClick={fetchAll} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition">
                    <RefreshCw size={15} />
                  </button>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                    <input
                      type="text"
                      placeholder="Search name, ABHA, complaint..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none w-64"
                    />
                  </div>
                  <button
                    onClick={() => setShowNewPatient(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm"
                  >
                    <Plus size={15} /> New Patient
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                      <th className="px-5 py-3 font-semibold">Patient</th>
                      <th className="px-5 py-3 font-semibold">ABHA / Language</th>
                      <th className="px-5 py-3 font-semibold">Chief Complaint</th>
                      <th className="px-5 py-3 font-semibold">Assigned Doctor</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                          {search ? "No patients match your search." : "No patients in queue."}
                        </td>
                      </tr>
                    ) : (
                      filtered.map(p => (
                        <tr
                          key={p.id}
                          className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${p.is_emergency ? "bg-red-50/60" : ""}`}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                                p.is_emergency ? "bg-red-100 text-red-700" :
                                p.is_ayush ? "bg-amber-100 text-amber-700" :
                                "bg-indigo-100 text-indigo-700"
                              }`}>
                                {(p.name?.[0] ?? "?").toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                                  {p.is_ayush && <Leaf size={11} className="text-amber-600" />}
                                </div>
                                <p className="text-xs text-slate-400">{p.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="text-xs text-slate-500 font-mono">{p.abha_id || <span className="text-slate-300 italic">Guest</span>}</p>
                            {p.language && (
                              <p className="text-xs text-slate-400 mt-0.5">{LANGUAGE_MAP[p.language]?.nativeName || p.language}</p>
                            )}
                          </td>
                          <td className="px-5 py-3.5 max-w-[200px]">
                            <p className="text-sm text-slate-600 truncate">{p.chief_complaint || "—"}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5 text-sm text-indigo-600">
                              <Stethoscope size={13} />
                              <span className="truncate max-w-[120px] text-xs">{p.assigned_doctor}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusPill status={p.status} isEmergency={p.is_emergency} />
                          </td>
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => router.push(`/doctor?patientId=${p.id}`)}
                              className="text-indigo-600 text-sm font-semibold hover:underline"
                            >
                              {p.status === "Summary Ready" ? "Route to Doctor →" : "View Session →"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Doctors Panel */}
            <div className="w-64 flex-shrink-0">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="font-bold text-slate-800 text-sm">Doctors On Duty</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{available} of {doctors.length} available</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {doctors.map(d => (
                    <div key={d.id} className="px-5 py-3.5 flex items-start gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${d.is_available ? "bg-emerald-400" : "bg-slate-300"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{d.name}</p>
                        <p className="text-xs text-slate-400 truncate">{d.department}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {d.speciality === "AYUSH" && (
                            <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium">AYUSH</span>
                          )}
                          <span className="text-xs text-slate-300">{d.patients_today} today</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {doctors.length === 0 && (
                    <div className="p-5 text-center text-slate-400 text-sm">No doctors loaded</div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </SidebarInset>

      {/* New Patient Modal */}
      <AnimatePresence>
        {showNewPatient && <NewPatientModal onClose={() => setShowNewPatient(false)} />}
      </AnimatePresence>
    </SidebarProvider>
  );
}
