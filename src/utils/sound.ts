export type SoundOptions = {
  muted?: boolean;
};

interface NoteSpec {
  frequency: number;
  startOffset: number;
  duration: number;
  peakGain: number;
  type: OscillatorType;
}

type AudioContextHost = typeof globalThis & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

const DISCARD_NOTES: readonly NoteSpec[] = [
  { frequency: 220, startOffset: 0, duration: 0.08, peakGain: 0.12, type: 'triangle' },
];

const CAPTURE_NOTES: readonly NoteSpec[] = [
  { frequency: 523.25, startOffset: 0, duration: 0.09, peakGain: 0.13, type: 'sine' },
  { frequency: 659.25, startOffset: 0.075, duration: 0.13, peakGain: 0.15, type: 'sine' },
];

const ESCOBA_NOTES: readonly NoteSpec[] = [
  { frequency: 523.25, startOffset: 0, duration: 0.1, peakGain: 0.14, type: 'triangle' },
  { frequency: 659.25, startOffset: 0.08, duration: 0.1, peakGain: 0.15, type: 'triangle' },
  { frequency: 783.99, startOffset: 0.16, duration: 0.12, peakGain: 0.16, type: 'triangle' },
  { frequency: 1046.5, startOffset: 0.25, duration: 0.22, peakGain: 0.18, type: 'triangle' },
];

const VICTORY_NOTES: readonly NoteSpec[] = [
  { frequency: 523.25, startOffset: 0, duration: 0.11, peakGain: 0.14, type: 'triangle' },
  { frequency: 659.25, startOffset: 0.1, duration: 0.11, peakGain: 0.14, type: 'triangle' },
  { frequency: 783.99, startOffset: 0.2, duration: 0.12, peakGain: 0.16, type: 'triangle' },
  { frequency: 1046.5, startOffset: 0.31, duration: 0.16, peakGain: 0.17, type: 'triangle' },
  { frequency: 1318.51, startOffset: 0.45, duration: 0.32, peakGain: 0.18, type: 'triangle' },
];

let cachedAudioContext: AudioContext | null = null;

/**
 * Obtiene de forma perezosa y segura el `AudioContext` disponible en el entorno.
 */
function getAudioContext(): AudioContext | null {
  if (cachedAudioContext) {
    return cachedAudioContext;
  }

  try {
    const host = globalThis as AudioContextHost;
    const AudioCtx = host.AudioContext ?? host.webkitAudioContext;
    if (typeof AudioCtx !== 'function') {
      return null;
    }

    cachedAudioContext = new AudioCtx();
    return cachedAudioContext;
  } catch {
    return null;
  }
}

/**
 * Reproduce una secuencia de notas usando Web Audio API con degradación silenciosa.
 */
function playNoteSequence(notes: readonly NoteSpec[], options?: SoundOptions): void {
  if (options?.muted) {
    return;
  }

  try {
    const ctx = getAudioContext();
    if (!ctx) {
      return;
    }

    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      Promise.resolve(ctx.resume()).catch(() => {});
    }

    const baseTime = typeof ctx.currentTime === 'number' ? ctx.currentTime : 0;

    for (const note of notes) {
      const startTime = baseTime + note.startOffset;
      const endTime = startTime + note.duration;
      const attackTime = startTime + Math.min(0.015, note.duration * 0.25);

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = note.type;
      osc.frequency.setValueAtTime(note.frequency, startTime);

      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.linearRampToValueAtTime(note.peakGain, attackTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(endTime);
    }
  } catch {
    // Degradación silenciosa si el navegador bloquea o falla al sintetizar audio.
  }
}

/**
 * Reproduce un tono seco breve al descartar una carta sobre la mesa.
 */
export function playDiscardSound(options?: SoundOptions): void {
  playNoteSequence(DISCARD_NOTES, options);
}

/**
 * Reproduce dos notas ascendentes al capturar cartas.
 */
export function playCaptureSound(options?: SoundOptions): void {
  playNoteSequence(CAPTURE_NOTES, options);
}

/**
 * Reproduce una fanfarria alegre al lograr una Escoba.
 */
export function playEscobaSound(options?: SoundOptions): void {
  playNoteSequence(ESCOBA_NOTES, options);
}

/**
 * Reproduce una fanfarria triunfal al finalizar la partida.
 */
export function playVictorySound(options?: SoundOptions): void {
  playNoteSequence(VICTORY_NOTES, options);
}
