/**
 * MediKiosk — Language Configuration
 * Supported languages with metadata for UI display and API calls.
 */

export interface Language {
  code: string;        // API code (en, hi, ta, te, mr)
  name: string;        // English name
  nativeName: string;  // Name in native script
  flag: string;        // Flag emoji
  greeting: string;    // Welcome message in native language
  placeholder: string; // Chat input placeholder
  speakPrompt: string; // Mic button prompt
}

export const LANGUAGES: Language[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
    greeting: 'Hello! Please describe what brings you here today.',
    placeholder: 'Type your symptoms here...',
    speakPrompt: 'Hold to speak',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिंदी',
    flag: '🇮🇳',
    greeting: 'नमस्ते! आज आप यहाँ क्यों आए हैं, कृपया बताएं।',
    placeholder: 'अपने लक्षण यहाँ टाइप करें...',
    speakPrompt: 'बोलने के लिए दबाएं',
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    flag: '🌟',
    greeting: 'வணக்கம்! இன்று நீங்கள் ஏன் வந்தீர்கள் என்று சொல்லுங்கள்.',
    placeholder: 'உங்கள் அறிகுறிகளை இங்கே தட்டச்சு செய்யுங்கள்...',
    speakPrompt: 'பேச அழுத்தவும்',
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    flag: '🌟',
    greeting: 'నమస్కారం! ఈ రోజు మీరు ఎందుకు వచ్చారో చెప్పండి.',
    placeholder: 'మీ లక్షణాలు ఇక్కడ టైప్ చేయండి...',
    speakPrompt: 'మాట్లాడేందుకు నొక్కండి',
  },
  {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    flag: '🌟',
    greeting: 'नमस्कार! आज तुम्ही का आलात ते सांगा.',
    placeholder: 'तुमची लक्षणे येथे टाइप करा...',
    speakPrompt: 'बोलण्यासाठी दाबा',
  },
];

export const LANGUAGE_MAP: Record<string, Language> = Object.fromEntries(
  LANGUAGES.map(l => [l.code, l])
);

export function getLanguage(code: string): Language {
  return LANGUAGE_MAP[code] || LANGUAGE_MAP['en'];
}

// OPD mode labels
export const OPD_MODES = {
  allopathic: {
    label: 'General OPD',
    sublabel: 'Allopathic Medicine',
    description: 'SOCRATES symptom assessment',
    color: 'blue',
    icon: '🏥',
  },
  ayush: {
    label: 'AYUSH OPD',
    sublabel: 'Ayurvedic Medicine',
    description: 'Dashavidha Pariksha assessment',
    color: 'amber',
    icon: '🌿',
  },
} as const;

// Status display config
export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  'Summary Ready':   { label: 'Summary Ready',   color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  'In Session':      { label: 'In Session',       color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',    dot: 'bg-amber-500' },
  'EMERGENCY':       { label: 'EMERGENCY',         color: 'text-red-700',     bg: 'bg-red-50 border-red-200',        dot: 'bg-red-500' },
  'Waiting':         { label: 'Waiting',           color: 'text-slate-600',   bg: 'bg-slate-50 border-slate-200',    dot: 'bg-slate-400' },
  'Completed':       { label: 'Completed',         color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200',  dot: 'bg-indigo-500' },
};
