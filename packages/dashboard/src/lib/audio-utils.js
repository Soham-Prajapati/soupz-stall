/**
 * Audio recording and WAV conversion utilities for Sarvam STT.
 *
 * Sarvam's speech-to-text API rejects WebM audio. These helpers record via
 * MediaRecorder (which produces WebM/Opus on most browsers) and then decode +
 * re-encode the result as 16 kHz mono PCM WAV.
 */

// ── WAV encoding helpers ────────────────────────────────────────────────────

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Convert an audio Blob (typically WebM) to a 16 kHz mono WAV Blob.
 *
 * Uses an offline AudioContext to decode the source format and then manually
 * writes a PCM WAV file (44-byte header + 16-bit samples).
 *
 * @param {Blob} blob - Source audio blob (any format the browser can decode).
 * @returns {Promise<Blob>} WAV blob with MIME type `audio/wav`.
 */
export async function convertToWav(blob) {
  const audioContext = new AudioContext({ sampleRate: 16000 });
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const numChannels = 1;
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);
    const length = channelData.length;

    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(view, 8, 'WAVE');

    // fmt subchunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);       // subchunk size
    view.setUint16(20, 1, true);        // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
    view.setUint16(32, numChannels * 2, true);              // block align
    view.setUint16(34, 16, true);       // bits per sample

    // data subchunk
    writeString(view, 36, 'data');
    view.setUint32(40, length * 2, true);

    let offset = 44;
    for (let i = 0; i < length; i++, offset += 2) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  } finally {
    await audioContext.close();
  }
}
