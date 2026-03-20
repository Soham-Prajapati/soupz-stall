import { useState, useRef, useCallback } from 'react';

/**
 * Module-level singleton so the model persists across re-renders and component
 * unmounts. Kokoro-82M is ~80 MB; we only want to download/initialise it once
 * per page load.
 */
let _model = null;
let _loading = false;
/** Queue of resolve callbacks waiting for an in-progress load to finish. */
const _loadCallbacks = [];

/**
 * Strips Markdown syntax so the TTS engine reads natural prose instead of raw
 * markup tokens (asterisks, backticks, pound-signs, etc.).
 */
function stripMarkdown(text) {
  return (text || '')
    .replace(/```[\s\S]*?```/g, ', code block,')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Lazily loads the Kokoro-82M ONNX model (q8 quantised).  Concurrent callers
 * are queued and resolved together once the single in-flight load settles.
 *
 * @param {(progress: number) => void} [onProgress] - Callback receiving 0-100.
 * @returns {Promise<import('kokoro-js').KokoroTTS | null>}
 */
async function ensureModel(onProgress) {
  if (_model) return _model;

  if (_loading) {
    // Another call is already loading — wait for it to resolve.
    return new Promise((resolve) => {
      _loadCallbacks.push(resolve);
    });
  }

  _loading = true;

  try {
    const { KokoroTTS } = await import('kokoro-js');
    _model = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-ONNX', {
      dtype: 'q8',
      progress_callback: (info) => {
        if (onProgress && typeof info?.progress === 'number') {
          onProgress(Math.round(info.progress));
        }
      },
    });

    // Notify any waiters.
    _loadCallbacks.forEach((cb) => cb(_model));
    _loadCallbacks.length = 0;

    return _model;
  } catch (err) {
    console.warn('[Kokoro TTS] Model load failed:', err);

    // Notify waiters with null so they can fall back.
    _loadCallbacks.forEach((cb) => cb(null));
    _loadCallbacks.length = 0;

    return null;
  } finally {
    _loading = false;
  }
}

/**
 * React hook that provides on-device neural TTS powered by Kokoro-82M running
 * entirely in the browser via WebAssembly.  Falls back to the native
 * `SpeechSynthesis` API if the model fails to load.
 *
 * @returns {{
 *   speak: (text: string) => Promise<void>,
 *   stop: () => void,
 *   speaking: boolean,
 *   modelLoading: boolean,
 *   loadProgress: number,
 * }}
 */
export function useKokoroTTS() {
  const [modelLoading, setModelLoading] = useState(false);
  /** Integer 0-100 reflecting download / initialisation progress. */
  const [loadProgress, setLoadProgress] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  /** Web Audio API context — reused across utterances. */
  const audioCtxRef = useRef(null);
  /** Currently-playing BufferSourceNode so we can stop it. */
  const sourceRef = useRef(null);

  /**
   * Immediately stops any ongoing playback (neural or SpeechSynthesis).
   */
  const stop = useCallback(() => {
    // Stop Web Audio playback.
    try {
      if (sourceRef.current) {
        sourceRef.current.onended = null; // prevent the onended handler racing
        sourceRef.current.stop();
        sourceRef.current = null;
      }
    } catch {
      // BufferSourceNode throws if already stopped — safe to ignore.
    }

    // Stop native SpeechSynthesis fallback.
    try {
      window.speechSynthesis?.cancel();
    } catch {}

    setSpeaking(false);
  }, []);

  /**
   * Converts `text` to speech.  On first call the Kokoro model is downloaded
   * and cached for all subsequent calls within the same page session.
   *
   * @param {string} text - Raw text (may contain Markdown).
   */
  const speak = useCallback(
    async (text) => {
      // Always cancel whatever is currently playing before starting a new utterance.
      stop();

      const plain = stripMarkdown(text);
      if (!plain) return;

      // Signal that we are about to load / are loading the model.
      setModelLoading(true);
      setLoadProgress(0);

      const model = await ensureModel((p) => setLoadProgress(p));

      setModelLoading(false);
      setLoadProgress(0);

      if (!model) {
        // Graceful fallback to native speech synthesis.
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          const utt = new SpeechSynthesisUtterance(plain);
          utt.rate = 1.0;
          utt.pitch = 1.0;
          const handleEnd = () => setSpeaking(false);
          utt.onend = handleEnd;
          utt.onerror = handleEnd;
          setSpeaking(true);
          window.speechSynthesis.speak(utt);
        }
        return;
      }

      try {
        setSpeaking(true);

        const result = await model.generate(plain, { voice: 'af_sky' });

        // result.audio is a Float32Array of normalised PCM samples.
        const audioData = result.audio;
        const sampleRate = result.sampling_rate;

        // Re-use the AudioContext if it is still open.
        if (
          !audioCtxRef.current ||
          audioCtxRef.current.state === 'closed'
        ) {
          audioCtxRef.current = new AudioContext({ sampleRate });
        }

        const ctx = audioCtxRef.current;

        // AudioContext may be suspended on mobile browsers until a user gesture.
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        const buffer = ctx.createBuffer(1, audioData.length, sampleRate);
        buffer.copyToChannel(audioData, 0);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => {
          setSpeaking(false);
          sourceRef.current = null;
        };
        source.start();
        sourceRef.current = source;
      } catch (err) {
        console.warn('[Kokoro TTS] Playback error:', err);
        setSpeaking(false);
      }
    },
    [stop],
  );

  return { speak, stop, speaking, modelLoading, loadProgress };
}
