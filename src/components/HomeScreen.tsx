import { useEffect, useId, useState } from 'react';
import { motion } from 'motion/react';
import type { BotDifficulty, RoomSnapshot, TargetScore } from '../../shared/types';
import type { PlayerCount } from '../hooks/useLocalGame';
import type { CreateOnlineRoomInput, JoinOnlineRoomInput } from '../hooks/useOnlineGame';
import { unlockAudio, playDealSound } from '../utils/sound';
import { OnlineLobby } from './OnlineLobby';
import { RadioSelectorGroup, type RadioOption } from './RadioSelectorGroup';

export type HomeMode = 'ai' | 'online';

export interface HomeScreenProps {
  difficulty: BotDifficulty;
  playerCount: PlayerCount;
  targetScore: TargetScore;
  onDifficultyChange: (difficulty: BotDifficulty) => void;
  onPlayerCountChange: (playerCount: PlayerCount) => void;
  onTargetScoreChange: (targetScore: TargetScore) => void;
  onStart: () => void;
  onlineSnapshot?: RoomSnapshot | null;
  onlineError?: string | null;
  onlineLoading?: boolean;
  onCreateOnlineRoom?: (input: CreateOnlineRoomInput) => void;
  onJoinOnlineRoom?: (input: JoinOnlineRoomInput) => void;
  onLeaveOnlineRoom?: () => void;
}

const DIFFICULTY_OPTIONS: RadioOption<BotDifficulty>[] = [
  { value: 'facil', label: 'Fácil' },
  { value: 'medio', label: 'Medio' },
  { value: 'dificil', label: 'Difícil' },
];

const PLAYER_COUNT_OPTIONS: RadioOption<PlayerCount>[] = [
  { value: 2, label: '2 jugadores (1v1)' },
  { value: 3, label: '3 jugadores' },
  { value: 4, label: '4 jugadores (2v2)' },
];

const TARGET_SCORE_OPTIONS: RadioOption<TargetScore>[] = [
  { value: 15, label: '15 puntos' },
  { value: 21, label: '21 puntos' },
];

const noop = () => {};

function getInitialRoomCode(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const rawCode = new URLSearchParams(window.location.search).get('sala');
  return rawCode ? rawCode.trim().toUpperCase() : '';
}

/** Pantalla inicial con selector de modalidad Contra IA u Online con un amigo. */
export function HomeScreen({
  difficulty,
  playerCount,
  targetScore,
  onDifficultyChange,
  onPlayerCountChange,
  onTargetScoreChange,
  onStart,
  onlineSnapshot = null,
  onlineError = null,
  onlineLoading = false,
  onCreateOnlineRoom = noop,
  onJoinOnlineRoom = noop,
  onLeaveOnlineRoom,
}: HomeScreenProps) {
  const baseId = useId();
  const [initialCode] = useState<string>(() => getInitialRoomCode());
  const [mode, setMode] = useState<HomeMode>(() => (initialCode ? 'online' : 'ai'));

  useEffect(() => {
    if (onlineError) {
      setMode('online');
    }
  }, [onlineError]);

  const aiTabId = `${baseId}-tab-ai`;
  const onlineTabId = `${baseId}-tab-online`;
  const aiPanelId = `${baseId}-panel-ai`;
  const onlinePanelId = `${baseId}-panel-online`;

  return (
    <main className="app-shell start-screen">
      <motion.div
        className="start-card"
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      >
        <h1 className="start-title">Escoba del 15</h1>

        <div className="mode-tabs" role="tablist" aria-label="Modalidad de juego">
          <button
            type="button"
            role="tab"
            id={aiTabId}
            aria-selected={mode === 'ai'}
            aria-controls={aiPanelId}
            className={`mode-tab ${mode === 'ai' ? 'mode-tab--active' : ''}`.trim()}
            onClick={() => setMode('ai')}
          >
            Contra IA
          </button>
          <button
            type="button"
            role="tab"
            id={onlineTabId}
            aria-selected={mode === 'online'}
            aria-controls={onlinePanelId}
            className={`mode-tab ${mode === 'online' ? 'mode-tab--active' : ''}`.trim()}
            onClick={() => setMode('online')}
          >
            Online con un amigo
          </button>
        </div>

        {mode === 'ai' ? (
          <div
            role="tabpanel"
            id={aiPanelId}
            aria-labelledby={aiTabId}
            className="mode-panel"
          >
            <div className="home-config">
              <RadioSelectorGroup
                legend="Dificultad del bot"
                name={`${baseId}-difficulty`}
                options={DIFFICULTY_OPTIONS}
                selectedValue={difficulty}
                onChange={onDifficultyChange}
              />

              <RadioSelectorGroup
                legend="Cantidad de jugadores"
                name={`${baseId}-player-count`}
                options={PLAYER_COUNT_OPTIONS}
                selectedValue={playerCount}
                onChange={onPlayerCountChange}
              />

              <RadioSelectorGroup
                legend="Puntaje objetivo"
                name={`${baseId}-target-score`}
                options={TARGET_SCORE_OPTIONS}
                selectedValue={targetScore}
                onChange={onTargetScoreChange}
              />
            </div>

            <button
              type="button"
              className="play-button"
              onClick={() => {
                unlockAudio();
                playDealSound();
                onStart();
              }}
            >
              Jugar
            </button>
          </div>
        ) : (
          <div
            role="tabpanel"
            id={onlinePanelId}
            aria-labelledby={onlineTabId}
            className="mode-panel"
          >
            <OnlineLobby
              snapshot={onlineSnapshot}
              error={onlineError}
              loading={onlineLoading}
              initialCode={initialCode}
              onCreateRoom={onCreateOnlineRoom}
              onJoinRoom={onJoinOnlineRoom}
              onLeaveRoom={onLeaveOnlineRoom}
            />
          </div>
        )}
      </motion.div>
    </main>
  );
}
