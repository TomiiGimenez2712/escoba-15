import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SOUND_FN_NAMES = [
  'playCardSelectSound',
  'playDealSound',
  'playDiscardSound',
  'playCaptureSound',
  'playEscobaSound',
  'playVictorySound',
] as const;

function createMockAudioContext() {
  const oscillators: Array<{
    type: string;
    frequency: {
      value: number;
      setValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
      linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];

  const gains: Array<{
    gain: {
      value: number;
      setValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
      linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
  }> = [];

  const destination = { maxChannelCount: 2 };

  const context = {
    currentTime: 10,
    state: 'running',
    destination,
    resume: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: {
          value: 440,
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn(() => {
      const gainNode = {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };
      gains.push(gainNode);
      return gainNode;
    }),
  };

  const AudioContextMock = vi.fn(function () {
    return context;
  });

  return { AudioContextMock, context, oscillators, gains };
}

describe('utils/sound', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('degrada silenciosamente sin lanzar errores cuando AudioContext no existe o falla al construirse', async () => {
    const sound = await import('./sound');

    for (const fnName of SOUND_FN_NAMES) {
      expect(() => sound[fnName]()).not.toThrow();
    }

    vi.resetModules();
    const ThrowingAudioContext = vi.fn(function () {
      throw new Error('AudioContext no disponible');
    });
    vi.stubGlobal('AudioContext', ThrowingAudioContext);

    const soundWithError = await import('./sound');
    for (const fnName of SOUND_FN_NAMES) {
      expect(() => soundWithError[fnName]({ muted: false })).not.toThrow();
    }
  });

  it('no construye AudioContext ni crea osciladores cuando { muted: true }', async () => {
    const { AudioContextMock, context } = createMockAudioContext();
    vi.stubGlobal('AudioContext', AudioContextMock);

    const sound = await import('./sound');

    for (const fnName of SOUND_FN_NAMES) {
      sound[fnName]({ muted: true });
    }

    expect(AudioContextMock).not.toHaveBeenCalled();
    expect(context.createOscillator).not.toHaveBeenCalled();
    expect(context.createGain).not.toHaveBeenCalled();
  });

  it('crea osciladores y nodos de ganancia conectados con start/stop cuando no está silenciado', async () => {
    const { AudioContextMock, context, oscillators, gains } = createMockAudioContext();
    vi.stubGlobal('AudioContext', AudioContextMock);

    const sound = await import('./sound');

    for (const [index, fnName] of SOUND_FN_NAMES.entries()) {
      const prevOscCount = oscillators.length;
      const prevGainCount = gains.length;

      if (index % 2 === 0) {
        sound[fnName]({ muted: false });
      } else {
        sound[fnName]();
      }

      const newOscs = oscillators.slice(prevOscCount);
      const newGains = gains.slice(prevGainCount);

      expect(newOscs.length).toBeGreaterThanOrEqual(1);
      expect(newGains.length).toBeGreaterThanOrEqual(1);

      for (const osc of newOscs) {
        expect(osc.connect).toHaveBeenCalled();
        expect(osc.start).toHaveBeenCalled();
        expect(osc.stop).toHaveBeenCalled();
      }

      for (const gainNode of newGains) {
        expect(gainNode.connect).toHaveBeenCalledWith(context.destination);
      }
    }

    expect(AudioContextMock).toHaveBeenCalled();
  });

  it('inicia, programa notas criollas y detiene la música ambiental con degradación segura', async () => {
    const soundFallback = await import('./sound');
    expect(() => {
      soundFallback.unlockAudio();
      soundFallback.startBackgroundMusic();
      soundFallback.setBackgroundMusicMuted(false);
      soundFallback.setBackgroundMusicMuted(true);
      soundFallback.stopBackgroundMusic();
    }).not.toThrow();
    expect(soundFallback.isBackgroundMusicPlaying()).toBe(false);

    vi.resetModules();
    const { AudioContextMock, oscillators } = createMockAudioContext();
    vi.stubGlobal('AudioContext', AudioContextMock);

    const sound = await import('./sound');

    sound.startBackgroundMusic({ muted: true });
    expect(AudioContextMock).not.toHaveBeenCalled();
    expect(sound.isBackgroundMusicPlaying()).toBe(false);

    sound.startBackgroundMusic({ muted: false });
    expect(AudioContextMock).toHaveBeenCalledTimes(1);
    expect(sound.isBackgroundMusicPlaying()).toBe(true);
    expect(oscillators.length).toBeGreaterThanOrEqual(2);

    sound.setBackgroundMusicMuted(true);
    expect(sound.isBackgroundMusicPlaying()).toBe(false);
  });
});
