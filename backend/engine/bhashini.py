"""
MediKiosk — Bhashini Multi-language ASR/TTS Client
Supports: English (en), Hindi (hi), Tamil (ta), Telugu (te), Marathi (mr)
Falls back to Groq Whisper (ASR) and Edge-TTS (TTS) if Bhashini unavailable.
"""

import os
import asyncio
import base64
import tempfile
import requests


# Language → Bhashini service IDs
# These are the standard ULCA service IDs for common Indian languages
BHASHINI_ASR_SERVICE_IDS = {
    "hi": "ai4bharat/conformer-hi-gpu--t4",
    "ta": "ai4bharat/conformer-ta-gpu--t4",
    "te": "ai4bharat/conformer-te-gpu--t4",
    "mr": "ai4bharat/conformer-mr-gpu--t4",
    "en": "ai4bharat/whisper-medium-en--gpu--t4",
}

BHASHINI_TTS_SERVICE_IDS = {
    "hi": "ai4bharat/indic-tts-coqui-hi-gpu--t4",
    "ta": "ai4bharat/indic-tts-coqui-ta-gpu--t4",
    "te": "ai4bharat/indic-tts-coqui-te-gpu--t4",
    "mr": "ai4bharat/indic-tts-coqui-mr-gpu--t4",
    "en": "ai4bharat/indic-tts-coqui-en-gpu--t4",
}

# Edge-TTS voice mapping for fallback
EDGE_TTS_VOICES = {
    "en": "en-IN-NeerjaNeural",
    "hi": "hi-IN-SwaraNeural",
    "ta": "ta-IN-PallaviNeural",
    "te": "te-IN-ShrutiNeural",
    "mr": "mr-IN-AarohiNeural",
}

# Groq Whisper language codes
GROQ_WHISPER_LANG = {
    "hi": "hi",
    "ta": "ta",
    "te": "te",
    "mr": "mr",
    "en": "en",
}


class BhashiniClient:
    def __init__(self):
        self.api_key = os.getenv("BHASHINI_API_KEY", "")
        self.user_id = os.getenv("BHASHINI_USER_ID", "")
        self.base_url = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"

    @property
    def _is_configured(self) -> bool:
        return bool(self.api_key and self.user_id and self.api_key != "dummy")

    def speech_to_text(self, audio_data: bytes, source_language: str = "hi") -> str:
        """
        Transcribes audio to text using Bhashini ASR.
        Falls back to Groq Whisper if Bhashini is unavailable.
        Supports: en, hi, ta, te, mr
        """
        lang = source_language if source_language in BHASHINI_ASR_SERVICE_IDS else "hi"

        if not self._is_configured:
            print(f"[Bhashini] Not configured — falling back to Groq Whisper ({lang})")
            return self._fallback_asr_groq(audio_data, lang)

        print(f"[Bhashini] ASR request — language: {lang}")
        try:
            b64_audio = base64.b64encode(audio_data).decode("utf-8")
            headers = {
                "Authorization": self.api_key,
                "userID": self.user_id,
                "Content-Type": "application/json",
            }
            payload = {
                "pipelineTasks": [{
                    "taskType": "asr",
                    "config": {
                        "language": {"sourceLanguage": lang},
                        "serviceId": BHASHINI_ASR_SERVICE_IDS[lang],
                        "audioFormat": "webm",
                        "samplingRate": 16000,
                    }
                }],
                "inputData": {
                    "audio": [{"audioContent": b64_audio}]
                }
            }

            resp = requests.post(self.base_url, headers=headers, json=payload, timeout=15)
            if resp.status_code == 200:
                result = resp.json()
                text = result["pipelineResponse"][0]["output"][0]["source"]
                print(f"[Bhashini] ASR success: {text[:80]}")
                return text
            else:
                print(f"[Bhashini] ASR failed {resp.status_code}: {resp.text[:200]}")
                return self._fallback_asr_groq(audio_data, lang)

        except Exception as e:
            print(f"[Bhashini] ASR exception: {e}")
            return self._fallback_asr_groq(audio_data, lang)

    def text_to_speech(self, text: str, target_language: str = "hi") -> bytes:
        """
        Converts text to speech using Bhashini TTS.
        Falls back to Edge-TTS if Bhashini is unavailable.
        Supports: en, hi, ta, te, mr
        """
        lang = target_language if target_language in BHASHINI_TTS_SERVICE_IDS else "hi"

        if not self._is_configured:
            print(f"[Bhashini] Not configured — falling back to Edge-TTS ({lang})")
            return self._fallback_tts_edge(text, lang)

        print(f"[Bhashini] TTS request — language: {lang}")
        try:
            headers = {
                "Authorization": self.api_key,
                "userID": self.user_id,
                "Content-Type": "application/json",
            }
            payload = {
                "pipelineTasks": [{
                    "taskType": "tts",
                    "config": {
                        "language": {"sourceLanguage": lang},
                        "serviceId": BHASHINI_TTS_SERVICE_IDS[lang],
                        "gender": "female",
                        "samplingRate": 8000,
                    }
                }],
                "inputData": {
                    "input": [{"source": text[:500]}]  # Cap text for speed
                }
            }

            resp = requests.post(self.base_url, headers=headers, json=payload, timeout=15)
            if resp.status_code == 200:
                result = resp.json()
                b64_audio = result["pipelineResponse"][0]["audio"][0]["audioContent"]
                print("[Bhashini] TTS success")
                return base64.b64decode(b64_audio)
            else:
                print(f"[Bhashini] TTS failed {resp.status_code}: {resp.text[:200]}")
                return self._fallback_tts_edge(text, lang)

        except Exception as e:
            print(f"[Bhashini] TTS exception: {e}")
            return self._fallback_tts_edge(text, lang)

    # ─── Fallbacks ───────────────────────────────────────────────────────────

    def _fallback_asr_groq(self, audio_data: bytes, language: str = "hi") -> str:
        """Groq Whisper fallback for ASR — supports all 5 languages."""
        api_key = os.getenv("GROQ_API_KEY", "")
        if not api_key:
            return "__ERROR__"

        try:
            headers = {"Authorization": f"Bearer {api_key}"}
            files = {"file": ("audio.webm", audio_data, "audio/webm")}
            data = {
                "model": "whisper-large-v3",
                "response_format": "json",
                "language": GROQ_WHISPER_LANG.get(language, "hi"),
            }

            resp = requests.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers=headers,
                files=files,
                data=data,
                timeout=20,
            )
            if resp.status_code == 200:
                text = resp.json().get("text", "").strip()
                print(f"[Groq Whisper] Transcription: {text[:80]}")
                return text
            print(f"[Groq Whisper] Error {resp.status_code}: {resp.text[:200]}")
            return "__ERROR__"

        except Exception as e:
            print(f"[Groq Whisper] Exception: {e}")
            return "__ERROR__"

    def _fallback_tts_edge(self, text: str, language: str = "hi") -> bytes:
        """Edge-TTS fallback using subprocess with sys.executable to avoid asyncio loop deadlocks."""
        import subprocess
        import sys
        
        voice = EDGE_TTS_VOICES.get(language, EDGE_TTS_VOICES["en"])
        safe_text = text[:400]

        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        temp_file.close()

        try:
            # Using sys.executable guarantees it uses the current venv's python
            result = subprocess.run(
                [sys.executable, "-m", "edge_tts", "--text", safe_text, "--voice", voice, "--write-media", temp_file.name],
                capture_output=True,
                text=True,
                timeout=15
            )
            
            if result.returncode != 0:
                print(f"[Edge-TTS] Subprocess error: {result.stderr}")
                return b""

            with open(temp_file.name, "rb") as f:
                audio_data = f.read()

            if audio_data:
                print(f"[Edge-TTS] Success — voice: {voice}, bytes: {len(audio_data)}")
            else:
                print("[TTS] Error: Empty audio returned")
            return audio_data

        except Exception as e:
            print(f"[Edge-TTS] Exception: {e}")
            return b""
        finally:
            import os as _os
            if _os.path.exists(temp_file.name):
                _os.remove(temp_file.name)
