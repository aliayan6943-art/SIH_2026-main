"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  User, Phone, CreditCard, Stethoscope, Leaf, Calendar,
  FileText, AlertTriangle, Clock, CheckCircle2,
  Activity, Heart, Brain, Flame, Wind,
  Shield,
} from 'lucide-react';
import { getPatientProfile, PatientProfile } from '@/lib/api';
import { LANGUAGE_MAP } from '@/lib/languages';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={15} className="text-teal-400" />
      </div>
      <div>
        <p className="text-white/40 text-xs uppercase tracking-wide font-medium">{label}</p>
        <p className="text-white font-medium text-sm mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function SocratesGrid({ socrates }: { socrates: Record<string, string> }) {
  const icons: Record<string, React.ElementType> = {
    Site: Activity, Onset: Clock, Character: Heart,
    Radiation: Wind, Associated: Stethoscope, TimeCourse: Clock,
    Exacerbating: Flame, Severity: Brain,
  };

  const entries = Object.entries(socrates).filter(([, v]) => v && v !== 'Not reported');
  if (entries.length === 0) return <p className="text-white/30 text-sm italic">No symptom data collected.</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {entries.map(([key, val]) => {
        const Icon = icons[key] || Activity;
        return (
          <div key={key} className="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <Icon size={13} className="text-teal-400" />
              <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">{key}</span>
            </div>
            <p className="text-white text-sm font-medium leading-snug">{val}</p>
          </div>
        );
      })}
    </div>
  );
}

function AyushGrid({ ayush }: { ayush: Record<string, string> }) {
  const entries = Object.entries(ayush).filter(([, v]) => v && v !== 'Not collected');
  if (entries.length === 0) return <p className="text-white/30 text-sm italic">No AYUSH data collected.</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {entries.map(([key, val]) => (
        <div key={key} className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5">
          <p className="text-amber-400/70 text-xs font-semibold uppercase tracking-wide mb-1">{key}</p>
          <p className="text-amber-100 text-sm font-medium leading-snug">{val}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Profile Page ────────────────────────────────────────────────────────

export default function PatientProfilePage() {
  const params = useParams();
  const patientId = params.id as string;

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'symptoms' | 'ayush' | 'documents' | 'visits'>('summary');

  useEffect(() => {
    if (!patientId) return;
    getPatientProfile(patientId)
      .then(setProfile)
      .catch(() => setError('Could not load patient profile.'))
      .finally(() => setLoading(false));
  }, [patientId]);

  const lang = profile?.language ? LANGUAGE_MAP[profile.language] : LANGUAGE_MAP['en'];
  const hasAyush = profile?.ayush && Object.keys(profile.ayush).length > 0;
  const hasSocrates = profile?.socrates && Object.keys(profile.socrates).length > 0;

  const tabs = [
    { id: 'summary', label: 'Summary', icon: FileText },
    { id: 'symptoms', label: 'Symptoms', icon: Activity },
    ...(hasAyush ? [{ id: 'ayush', label: 'AYUSH', icon: Leaf }] : []),
    ...(profile?.documents?.length ? [{ id: 'documents', label: 'Documents', icon: FileText }] : []),
    ...(profile?.visits?.length ? [{ id: 'visits', label: 'Visits', icon: Clock }] : []),
  ] as { id: string; label: string; icon: React.ElementType }[];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60">Loading health profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={40} className="text-red-400 mx-auto mb-4" />
          <p className="text-white/60">{error || 'Profile not found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 font-sans pb-12">

      {/* ── Header ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-teal-600/20 to-cyan-600/20" />
        <div className="relative px-5 pt-10 pb-6 max-w-2xl mx-auto">
          <div className="flex items-start gap-5">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black shadow-2xl ${
              profile.is_ayush ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-gradient-to-br from-teal-500 to-cyan-500'
            }`}>
              {profile.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-2xl font-black text-white">{profile.name || 'Patient'}</h1>
                {profile.is_ayush && (
                  <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-400 text-xs font-semibold flex items-center gap-1">
                    <Leaf size={10} /> AYUSH
                  </span>
                )}
                {profile.is_demo && (
                  <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/40 rounded-full text-blue-400 text-xs font-semibold">Demo</span>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-white/50 text-sm">
                {profile.age && <span>{profile.age} years</span>}
                {profile.gender && <span>· {profile.gender === 'M' ? 'Male' : profile.gender === 'F' ? 'Female' : profile.gender}</span>}
                {profile.language && <span>· {lang?.nativeName || profile.language}</span>}
              </div>
              {profile.abha_id && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Shield size={12} className="text-teal-400" />
                  <span className="text-teal-400 text-xs font-mono">{profile.abha_id}</span>
                  <span className="text-white/30 text-xs">· ABHA Linked</span>
                </div>
              )}
            </div>
          </div>

          {/* Status badge */}
          {profile.status && (
            <div className={`mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold ${
              profile.status === 'EMERGENCY' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
              profile.status === 'Summary Ready' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
              'bg-amber-500/20 border-amber-500/50 text-amber-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                profile.status === 'EMERGENCY' ? 'bg-red-400 animate-pulse' :
                profile.status === 'Summary Ready' ? 'bg-emerald-400' : 'bg-amber-400'
              }`} />
              {profile.status}
            </div>
          )}
        </div>
      </div>

      {/* ── Emergency flags ── */}
      {profile.red_flags && profile.red_flags.length > 0 && (
        <div className="max-w-2xl mx-auto px-5 mb-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-red-400" />
              <span className="text-red-400 font-semibold text-sm">Clinical Flags</span>
            </div>
            {profile.red_flags.map((f, i) => (
              <p key={i} className="text-red-300 text-sm">• {f}</p>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab Navigation ── */}
      <div className="max-w-2xl mx-auto px-5 mb-6">
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/10 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition flex-1 justify-center ${
                  activeTab === tab.id
                    ? 'bg-teal-500 text-white shadow-lg'
                    : 'text-white/50 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="max-w-2xl mx-auto px-5 space-y-4">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              {/* Patient-friendly summary */}
              {profile.patient_summary && (
                <div className="bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border border-teal-500/20 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={16} className="text-teal-400" />
                    <span className="text-teal-400 font-semibold text-sm">Your Health Summary</span>
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed">{profile.patient_summary}</p>
                </div>
              )}

              {/* Key info cards */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-0">
                {profile.chief_complaint && (
                  <InfoRow icon={Stethoscope} label="Chief Complaint" value={profile.chief_complaint} />
                )}
                <InfoRow icon={User} label="Patient Name" value={profile.name} />
                <InfoRow icon={Calendar} label="Age" value={profile.age ? `${profile.age} years` : undefined} />
                <InfoRow icon={CreditCard} label="ABHA ID" value={profile.abha_id} />
                <InfoRow icon={Phone} label="Contact" value={profile.contact} />
                <InfoRow icon={Stethoscope} label="Assigned Doctor" value={profile.assigned_doctor} />
              </div>

              {/* Next steps */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <p className="text-white/40 text-xs uppercase tracking-wide font-semibold mb-3">What happens next?</p>
                {[
                  'Your health summary is with the doctor',
                  'Wait in the waiting area — you will be called by name',
                  'The doctor already has your full history',
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3 py-2">
                    <div className="w-6 h-6 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center flex-shrink-0 text-teal-400 text-xs font-bold">{i + 1}</div>
                    <p className="text-white/70 text-sm">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Symptoms / SOCRATES Tab */}
          {activeTab === 'symptoms' && (
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Activity size={16} className="text-teal-400" />
                  <h3 className="text-white font-semibold">Symptom Assessment (SOCRATES)</h3>
                </div>
                <SocratesGrid socrates={profile.socrates || {}} />
              </div>
            </div>
          )}

          {/* AYUSH Tab */}
          {activeTab === 'ayush' && (
            <div className="space-y-4">
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Leaf size={16} className="text-amber-400" />
                  <h3 className="text-white font-semibold">AYUSH Dashavidha Pariksha</h3>
                </div>
                <p className="text-amber-400/60 text-xs mb-4">
                  This assessment is conducted according to traditional Ayurvedic medicine principles. Data linked to your ABHA health record.
                </p>
                <AyushGrid ayush={profile.ayush || {}} />
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-3">
              {(profile.documents || []).map((doc, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
                      <FileText size={15} className="text-teal-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{doc.filename}</p>
                      <p className="text-white/30 text-xs">AI-extracted</p>
                    </div>
                  </div>
                  <p className="text-white/70 text-sm whitespace-pre-wrap leading-relaxed">{doc.extracted_data}</p>
                </div>
              ))}
            </div>
          )}

          {/* Visits Tab */}
          {activeTab === 'visits' && (
            <div className="space-y-3">
              {(profile.visits || []).map((visit, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-teal-400" />
                      <span className="text-white font-semibold text-sm">{visit.date}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      visit.status === 'Summary Ready' ? 'bg-emerald-500/20 text-emerald-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>{visit.status}</span>
                  </div>
                  <p className="text-white/50 text-sm">{visit.doctor} — {visit.department}</p>
                  {visit.chief_complaint && (
                    <p className="text-white/30 text-xs mt-1 truncate">{visit.chief_complaint}</p>
                  )}
                </div>
              ))}
            </div>
          )}

        </motion.div>

        {/* Footer */}
        <div className="text-center pt-4">
          <p className="text-white/20 text-xs flex items-center justify-center gap-2">
            <Shield size={12} />
            MediKiosk Health Record · ABDM Compliant · DPDPA 2023
          </p>
        </div>
      </div>
    </div>
  );
}
