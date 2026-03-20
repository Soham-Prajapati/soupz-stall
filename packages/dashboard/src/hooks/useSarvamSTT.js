import { useState, useRef, useCallback, useEffect } from 'react';
import { convertToWav } from '../lib/audio-utils';

const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';
const LOCAL_STORAGE_KEY = 'soupz_sarvam_key';

/**
 * React hook for speech-to-text via the Sarvam AI API.
 *
 * Records audio through the MediaRecorder API, converts the resulting WebM
 * blob to WAV (Sarvam requires WAV), and POSTs it directly to the Sarvam
 * endpoint from the browser (CORS-allowed).
 *
 * The API key is read from localStorage (`soupz_sarvam_key`).
 *
 * @param {object}  [options]
 * @param {string}  [options.languageCode='en-IN'] - BCP-47 language code.
 * @param {string}  [options.model='saaras:v3']    - Sarvam model identifier.
 * @returns {{
 *   startRecording: () => Promise<void>,
 *   stopRecording:  () => void,
 *   recording:      boolean,
 *   transcript:     string,
 *   error:          string | null,
 * }}
 */
export function useSarvamSTT({ languageCode = 'en-IN', model = 'saaras:v3' } = {}) {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  // Clean up on unmount -- stop any in-progress recording and release the mic.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ── Start ─────────────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript('');
    chunksRef.current = [];

    // Validate API key early so the user gets immediate feedback.
    const apiKey = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!apiKey) {
      setError('Sarvam API key not found. Set it in Settings (soupz_sarvam_key).');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Release mic immediately.
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        const rawBlob = new Blob(chunksRef.current, { type: mimeType });

        if (rawBlob.size < 100) {
          setError('No audio captured. Speak clearly and try again.');
          return;
        }

        // Convert WebM to WAV (Sarvam requires WAV).
        let audioBlob;
        try {
          audioBlob = await convertToWav(rawBlob);
        } catch {
          // Fall back to raw blob -- unlikely to succeed but worth trying.
          audioBlob = rawBlob;
        }

        // Build multipart/form-data payload.
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.wav');
        formData.append('model', model);
        formData.append('language_code', languageCode);

        try {
          const key = localStorage.getItem(LOCAL_STORAGE_KEY);
          const res = await fetch(SARVAM_STT_URL, {
            method: 'POST',
            headers: { 'api-subscription-key': key },
            body: formData,
          });

          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const msg = body?.error?.message || body?.message || `Sarvam API returned ${res.status}`;
            setError(msg);
            return;
          }

          const data = await res.json();
          const text = (data.transcript || '').trim();

          if (!text) {
            setError('Could not understand speech. Speak clearly and try again.');
            return;
          }

          setTranscript(text);
        } catch (fetchErr) {
          setError(`Network error calling Sarvam STT: ${fetchErr.message || fetchErr}`);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250); // collect chunks every 250 ms
      setRecording(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
        setError('Microphone access denied. Allow mic permission and try again.');
      } else {
        setError(`Microphone error: ${msg}`);
      }
    }
  }, [languageCode, model]);

  // ── Stop ──────────────────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop(); // triggers onstop handler above
    }
    setRecording(false);
  }, []);

  return { startRecording, stopRecording, recording, transcript, error };
}
