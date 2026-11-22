export type SoundOptions = {
  muted?: boolean;
};

interface NoteSpec {
  frequency: number;
  startOffset: number;
  duration: number;
  peakGain: number;
  type: OscillatorType;
  endFrequency?: number;
}

interface NoiseBurstSpec {
  startOffset: number;
  duration: number;
  peakGain: number;
  filterType: BiquadFilterType;
  frequency: number;
}

interface MusicStep {
  bassFreq?: number;
  guitarFreqs: readonly number[];
  bombo?: boolean;
}

type AudioContextHost = typeof globalThis & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

const CARD_SELECT_NOTES: readonly NoteSpec[] = [
  {
    frequency: 390,
    endFrequency: 520,
    startOffset: 0,
    duration: 0.042,
    peakGain: 0.075,
    type: 'triangle',
  },
];

const CARD_SELECT_NOISE: readonly NoiseBurstSpec[] = [
  {
    startOffset: 0,
    duration: 0.028,
    peakGain: 0.055,
    filterType: 'bandpass',
    frequency: 1900,
  },
];

const DEAL_NOTES: readonly NoteSpec[] = [
  { frequency: 280, endFrequency: 210, startOffset: 0, duration: 0.045, peakGain: 0.08, type: 'triangle' },
  { frequency: 320, endFrequency: 240, startOffset: 0.075, duration: 0.045, peakGain: 0.08, type: 'triangle' },
  { frequency: 360, endFrequency: 260, startOffset: 0.15, duration: 0.05, peakGain: 0.09, type: 'triangle' },
];

const DEAL_NOISE: readonly NoiseBurstSpec[] = [
  { startOffset: 0, duration: 0.032, peakGain: 0.065, filterType: 'bandpass', frequency: 1700 },
  { startOffset: 0.075, duration: 0.032, peakGain: 0.065, filterType: 'bandpass', frequency: 1850 },
  { startOffset: 0.15, duration: 0.036, peakGain: 0.07, filterType: 'bandpass', frequency: 2050 },
];

const DISCARD_NOTES: readonly NoteSpec[] = [
  {
    frequency: 240,
    endFrequency: 145,
    startOffset: 0,
    duration: 0.095,
    peakGain: 0.14,
    type: 'triangle',
  },
];

const DISCARD_NOISE: readonly NoiseBurstSpec[] = [
  {
    startOffset: 0,
    duration: 0.048,
    peakGain: 0.09,
    filterType: 'lowpass',
    frequency: 1400,
  },
];

const CAPTURE_NOTES: readonly NoteSpec[] = [
  { frequency: 440, startOffset: 0, duration: 0.09, peakGain: 0.12, type: 'triangle' },
  { frequency: 554.37, startOffset: 0.065, duration: 0.12, peakGain: 0.14, type: 'sine' },
  { frequency: 659.25, startOffset: 0.12, duration: 0.16, peakGain: 0.14, type: 'triangle' },
];

const CAPTURE_NOISE: readonly NoiseBurstSpec[] = [
  {
    startOffset: 0,
    duration: 0.055,
    peakGain: 0.085,
    filterType: 'bandpass',
    frequency: 2100,
  },
];

const ESCOBA_NOTES: readonly NoteSpec[] = [
  { frequency: 440, startOffset: 0, duration: 0.11, peakGain: 0.14, type: 'triangle' },
  { frequency: 554.37, startOffset: 0.07, duration: 0.11, peakGain: 0.14, type: 'triangle' },
  { frequency: 659.25, startOffset: 0.14, duration: 0.13, peakGain: 0.16, type: 'triangle' },
  { frequency: 880, startOffset: 0.22, duration: 0.25, peakGain: 0.18, type: 'triangle' },
  { frequency: 1108.73, startOffset: 0.28, duration: 0.28, peakGain: 0.13, type: 'sine' },
];

const VICTORY_NOTES: readonly NoteSpec[] = [
  { frequency: 440, startOffset: 0, duration: 0.12, peakGain: 0.14, type: 'triangle' },
  { frequency: 554.37, startOffset: 0.09, duration: 0.12, peakGain: 0.14, type: 'triangle' },
  { frequency: 659.25, startOffset: 0.18, duration: 0.14, peakGain: 0.15, type: 'triangle' },
  { frequency: 880, startOffset: 0.28, duration: 0.18, peakGain: 0.17, type: 'triangle' },
  { frequency: 1108.73, startOffset: 0.4, duration: 0.26, peakGain: 0.16, type: 'triangle' },
  { frequency: 1318.51, startOffset: 0.5, duration: 0.36, peakGain: 0.16, type: 'sine' },
];

// Cadencia criolla / milonga campera en La menor (Am -> Dm -> G7 -> Cmaj7 -> F -> Dm6 -> E7 -> Am)
const MUSIC_STEP_DURATION_S = 0.215;
const MUSIC_LOOKAHEAD_S = 0.26;
const MUSIC_SCHEDULER_INTERVAL_MS = 110;

const MILONGA_PATTERN: readonly MusicStep[] = [
  // Am
  { bassFreq: 110.0, guitarFreqs: [220.0, 261.63], bombo: true },
  { guitarFreqs: [329.63] },
  { guitarFreqs: [440.0] },
  { bassFreq: 164.81, guitarFreqs: [329.63], bombo: true },
  { guitarFreqs: [261.63] },
  { guitarFreqs: [329.63] },
  { bassFreq: 110.0, guitarFreqs: [220.0], bombo: true },
  { guitarFreqs: [392.0] },
  // Dm
  { bassFreq: 146.83, guitarFreqs: [293.66, 349.23], bombo: true },
  { guitarFreqs: [440.0] },
  { guitarFreqs: [587.33] },
  { bassFreq: 110.0, guitarFreqs: [440.0], bombo: true },
  { guitarFreqs: [349.23] },
  { guitarFreqs: [440.0] },
  { bassFreq: 146.83, guitarFreqs: [293.66], bombo: true },
  { guitarFreqs: [523.25] },
  // G7
  { bassFreq: 98.0, guitarFreqs: [246.94, 349.23], bombo: true },
  { guitarFreqs: [392.0] },
  { guitarFreqs: [493.88] },
  { bassFreq: 146.83, guitarFreqs: [392.0], bombo: true },
  { guitarFreqs: [349.23] },
  { guitarFreqs: [392.0] },
  { bassFreq: 98.0, guitarFreqs: [246.94], bombo: true },
  { guitarFreqs: [440.0] },
  // Cmaj7
  { bassFreq: 130.81, guitarFreqs: [261.63, 329.63], bombo: true },
  { guitarFreqs: [392.0] },
  { guitarFreqs: [493.88] },
  { bassFreq: 98.0, guitarFreqs: [392.0], bombo: true },
  { guitarFreqs: [329.63] },
  { guitarFreqs: [392.0] },
  { bassFreq: 130.81, guitarFreqs: [261.63], bombo: true },
  { guitarFreqs: [329.63] },
  // Fmaj7
  { bassFreq: 87.31, guitarFreqs: [220.0, 329.63], bombo: true },
  { guitarFreqs: [349.23] },
  { guitarFreqs: [440.0] },
  { bassFreq: 130.81, guitarFreqs: [349.23], bombo: true },
  { guitarFreqs: [261.63] },
  { guitarFreqs: [349.23] },
  { bassFreq: 87.31, guitarFreqs: [220.0], bombo: true },
  { guitarFreqs: [329.63] },
  // Dm6
  { bassFreq: 146.83, guitarFreqs: [246.94, 349.23], bombo: true },
  { guitarFreqs: [440.0] },
  { guitarFreqs: [493.88] },
  { bassFreq: 110.0, guitarFreqs: [349.23], bombo: true },
  { guitarFreqs: [293.66] },
  { guitarFreqs: [349.23] },
  { bassFreq: 146.83, guitarFreqs: [246.94], bombo: true },
  { guitarFreqs: [392.0] },
  // E7
  { bassFreq: 82.41, guitarFreqs: [207.65, 293.66], bombo: true },
  { guitarFreqs: [329.63] },
  { guitarFreqs: [415.3] },
  { bassFreq: 123.47, guitarFreqs: [329.63], bombo: true },
  { guitarFreqs: [293.66] },
  { guitarFreqs: [329.63] },
  { bassFreq: 82.41, guitarFreqs: [207.65], bombo: true },
  { guitarFreqs: [392.0] },
  // Am (cadencia de cierre)
  { bassFreq: 110.0, guitarFreqs: [220.0, 329.63], bombo: true },
  { guitarFreqs: [440.0] },
  { guitarFreqs: [523.25] },
  { bassFreq: 164.81, guitarFreqs: [440.0], bombo: true },
  { guitarFreqs: [329.63] },
  { guitarFreqs: [261.63] },
  { bassFreq: 110.0, guitarFreqs: [220.0], bombo: true },
  { guitarFreqs: [293.66] },
];

let cachedAudioContext: AudioContext | null = null;
let musicSchedulerId: ReturnType<typeof setInterval> | null = null;
let musicMasterGain: GainNode | null = null;
let musicWanted = false;
let musicStepIndex = 0;
let musicNextStepTime = 0;

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

function resumeContextSafely(ctx: AudioContext): void {
  if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
    Promise.resolve(ctx.resume()).catch(() => {});
  }
}

function playNoiseBursts(
  ctx: AudioContext,
  baseTime: number,
  bursts: readonly NoiseBurstSpec[],
): void {
  if (
    typeof ctx.createBuffer !== 'function' ||
    typeof ctx.createBufferSource !== 'function' ||
    typeof ctx.sampleRate !== 'number'
  ) {
    return;
  }

  for (const burst of bursts) {
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * burst.duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < sampleCount; i += 1) {
      const decay = 1 - i / sampleCount;
      channelData[i] = (Math.random() * 2 - 1) * decay;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = ctx.createGain();
    const startTime = baseTime + burst.startOffset;
    const endTime = startTime + burst.duration;
    gainNode.gain.setValueAtTime(burst.peakGain, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

    if (typeof ctx.createBiquadFilter === 'function') {
      const filter = ctx.createBiquadFilter();
      filter.type = burst.filterType;
      filter.frequency.setValueAtTime(burst.frequency, startTime);
      source.connect(filter);
      filter.connect(gainNode);
    } else {
      source.connect(gainNode);
    }

    gainNode.connect(ctx.destination);
    source.start(startTime);
    source.stop(endTime);
  }
}

/**
 * Reproduce una secuencia de notas y textura de naipes usando Web Audio API con degradación silenciosa.
 */
function playSoundEffect(
  notes: readonly NoteSpec[],
  noiseBursts: readonly NoiseBurstSpec[] = [],
  options?: SoundOptions,
): void {
  if (options?.muted) {
    return;
  }

  try {
    const ctx = getAudioContext();
    if (!ctx) {
      return;
    }

    resumeContextSafely(ctx);
    const baseTime = typeof ctx.currentTime === 'number' ? ctx.currentTime : 0;

    playNoiseBursts(ctx, baseTime, noiseBursts);

    for (const note of notes) {
      const startTime = baseTime + note.startOffset;
      const endTime = startTime + note.duration;
      const attackTime = startTime + Math.min(0.015, note.duration * 0.25);

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = note.type;
      osc.frequency.setValueAtTime(note.frequency, startTime);
      if (note.endFrequency !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(note.endFrequency, endTime);
      }

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

function getMusicDestination(ctx: AudioContext): AudioNode {
  if (!musicMasterGain) {
    musicMasterGain = ctx.createGain();
    const now = typeof ctx.currentTime === 'number' ? ctx.currentTime : 0;
    musicMasterGain.gain.setValueAtTime(0.0001, now);
    musicMasterGain.gain.linearRampToValueAtTime(0.85, now + 0.35);
    musicMasterGain.connect(ctx.destination);
  }
  return musicMasterGain;
}

function scheduleGuitarPluck(
  ctx: AudioContext,
  destination: AudioNode,
  frequency: number,
  startTime: number,
  duration: number,
  peakGain: number,
): void {
  const endTime = startTime + duration;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(frequency, startTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.linearRampToValueAtTime(peakGain, startTime + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

  if (typeof ctx.createBiquadFilter === 'function') {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(2400, frequency * 4.5), startTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(380, frequency * 1.4), endTime);
    osc.connect(filter);
    filter.connect(gainNode);
  } else {
    osc.connect(gainNode);
  }

  gainNode.connect(destination);
  osc.start(startTime);
  osc.stop(endTime);
}

function scheduleBomboHit(ctx: AudioContext, destination: AudioNode, startTime: number): void {
  const duration = 0.14;
  const endTime = startTime + duration;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(98, startTime);
  osc.frequency.exponentialRampToValueAtTime(48, endTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.linearRampToValueAtTime(0.048, startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

  osc.connect(gainNode);
  gainNode.connect(destination);
  osc.start(startTime);
  osc.stop(endTime);
}

function scheduleMusicPump(): void {
  if (!musicWanted) {
    return;
  }

  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state === 'suspended') {
      return;
    }

    const now = typeof ctx.currentTime === 'number' ? ctx.currentTime : 0;
    if (musicNextStepTime < now - 0.05) {
      musicNextStepTime = now + 0.03;
    }

    const destination = getMusicDestination(ctx);

    while (musicNextStepTime < now + MUSIC_LOOKAHEAD_S) {
      const step = MILONGA_PATTERN[musicStepIndex % MILONGA_PATTERN.length];

      if (step.bassFreq) {
        scheduleGuitarPluck(ctx, destination, step.bassFreq, musicNextStepTime, 0.55, 0.055);
      }

      step.guitarFreqs.forEach((freq, idx) => {
        scheduleGuitarPluck(
          ctx,
          destination,
          freq,
          musicNextStepTime + idx * 0.012,
          0.42,
          0.036,
        );
      });

      if (step.bombo) {
        scheduleBomboHit(ctx, destination, musicNextStepTime);
      }

      musicNextStepTime += MUSIC_STEP_DURATION_S;
      musicStepIndex = (musicStepIndex + 1) % MILONGA_PATTERN.length;
    }
  } catch {
    // Degradación silenciosa si el navegador restringe la síntesis continua.
  }
}

/**
 * Desbloquea el `AudioContext` en respuesta directa a una interacción del usuario.
 */
export function unlockAudio(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) {
      return;
    }

    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      Promise.resolve(ctx.resume())
        .then(() => {
          if (musicWanted) {
            scheduleMusicPump();
          }
        })
        .catch(() => {});
    } else if (musicWanted) {
      scheduleMusicPump();
    }
  } catch {
    // Degradación silenciosa.
  }
}

/**
 * Inicia el acompañamiento ambiental criollo de guitarra y bombo en Web Audio API.
 */
export function startBackgroundMusic(options?: SoundOptions): void {
  if (options?.muted) {
    stopBackgroundMusic();
    return;
  }

  musicWanted = true;

  try {
    const ctx = getAudioContext();
    if (!ctx) {
      return;
    }

    resumeContextSafely(ctx);
    const now = typeof ctx.currentTime === 'number' ? ctx.currentTime : 0;
    if (musicNextStepTime < now) {
      musicNextStepTime = now + 0.04;
    }

    if (!musicSchedulerId) {
      musicSchedulerId = setInterval(scheduleMusicPump, MUSIC_SCHEDULER_INTERVAL_MS);
    }

    scheduleMusicPump();
  } catch {
    // Degradación silenciosa.
  }
}

/**
 * Detiene por completo la música de fondo y libera el temporizador activo.
 */
export function stopBackgroundMusic(): void {
  musicWanted = false;

  if (musicSchedulerId !== null) {
    clearInterval(musicSchedulerId);
    musicSchedulerId = null;
  }

  try {
    if (musicMasterGain && cachedAudioContext) {
      const now = typeof cachedAudioContext.currentTime === 'number' ? cachedAudioContext.currentTime : 0;
      musicMasterGain.gain.setValueAtTime(0.0001, now);
    }
  } catch {
    // Degradación silenciosa.
  }

  musicMasterGain = null;
}

/**
 * Silencia o reactiva la música ambiental de fondo.
 */
export function setBackgroundMusicMuted(muted: boolean): void {
  if (muted) {
    stopBackgroundMusic();
  } else {
    startBackgroundMusic({ muted: false });
  }
}

/**
 * Indica si la música ambiental está activa.
 */
export function isBackgroundMusicPlaying(): boolean {
  return musicWanted;
}

/**
 * Reproduce un toque suave al seleccionar o deseleccionar una carta.
 */
export function playCardSelectSound(options?: SoundOptions): void {
  playSoundEffect(CARD_SELECT_NOTES, CARD_SELECT_NOISE, options);
}

/**
 * Reproduce un sonido de reparto rápido al iniciar ronda o mano.
 */
export function playDealSound(options?: SoundOptions): void {
  playSoundEffect(DEAL_NOTES, DEAL_NOISE, options);
}

/**
 * Reproduce un sonido de naipe sobre el paño al descartar una carta.
 */
export function playDiscardSound(options?: SoundOptions): void {
  playSoundEffect(DISCARD_NOTES, DISCARD_NOISE, options);
}

/**
 * Reproduce notas ascendentes y barrido de cartas al capturar.
 */
export function playCaptureSound(options?: SoundOptions): void {
  playSoundEffect(CAPTURE_NOTES, CAPTURE_NOISE, options);
}

/**
 * Reproduce una fanfarria criolla alegre al lograr una Escoba.
 */
export function playEscobaSound(options?: SoundOptions): void {
  playSoundEffect(ESCOBA_NOTES, CAPTURE_NOISE, options);
}

/**
 * Reproduce una fanfarria triunfal al finalizar la partida.
 */
export function playVictorySound(options?: SoundOptions): void {
  playSoundEffect(VICTORY_NOTES, [], options);
}
