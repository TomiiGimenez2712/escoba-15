import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { RoomSnapshot, TargetScore } from '../../shared/types';
import type { CreateOnlineRoomInput, JoinOnlineRoomInput } from '../hooks/useOnlineGame';
import { unlockAudio } from '../utils/sound';
import { RadioSelectorGroup, type RadioOption } from './RadioSelectorGroup';

export interface OnlineLobbyProps {
  snapshot: RoomSnapshot | null;
  error: string | null;
  loading: boolean;
  initialCode?: string;
  onCreateRoom: (input: CreateOnlineRoomInput) => void;
  onJoinRoom: (input: JoinOnlineRoomInput) => void;
  onLeaveRoom?: () => void;
}

const TARGET_SCORE_OPTIONS: RadioOption<TargetScore>[] = [
  { value: 15, label: '15 puntos' },
  { value: 21, label: '21 puntos' },
];

/** Lobby online para crear una sala, unirse por código o esperar al rival. */
export function OnlineLobby({
  snapshot,
  error,
  loading,
  initialCode = '',
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
}: OnlineLobbyProps) {
  const baseId = useId();
  const [playerName, setPlayerName] = useState('');
  const [targetScore, setTargetScore] = useState<TargetScore>(15);
  const [roomCode, setRoomCode] = useState(initialCode);
  const [copiedFeedback, setCopiedFeedback] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async (value: string, feedback: string) => {
    try {
      if (!navigator.clipboard?.writeText) {
        return;
      }
      await navigator.clipboard.writeText(value);
      setCopiedFeedback(feedback);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopiedFeedback(null);
      }, 2000);
    } catch {
      // Ignorar si el navegador bloquea el portapapeles
    }
  };

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    unlockAudio();
    onCreateRoom({ playerName, targetScore });
  };

  const handleJoinSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    unlockAudio();
    onJoinRoom({ code: roomCode, playerName });
  };

  if (snapshot && snapshot.status === 'waiting') {
    const shareUrl = `${window.location.origin}${window.location.pathname}?sala=${snapshot.code}`;

    return (
      <section className="online-lobby" aria-label="Sala de espera online">
        <div className="room-code-display">
          <span className="room-code-display__label">Código de sala</span>
          <strong className="room-code-display__value">{snapshot.code}</strong>
        </div>

        <p className="online-waiting-text" role="status">
          Esperando a tu amigo...
        </p>

        <ul className="online-player-list" aria-label="Jugadores en la sala">
          {snapshot.players.map((player) => (
            <li key={player.id} className="online-player-item">
              <span>{player.name}</span>
              <span className="online-player-status">
                {player.connected ? 'Conectado' : 'Desconectado'}
              </span>
            </li>
          ))}
        </ul>

        <div className="copy-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleCopy(snapshot.code, 'Copiado')}
          >
            Copiar código
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleCopy(shareUrl, 'Copiado')}
          >
            Copiar enlace
          </button>
        </div>

        {copiedFeedback && (
          <p className="copy-feedback" role="status">
            {copiedFeedback}
          </p>
        )}

        {onLeaveRoom && (
          <button type="button" className="secondary-button" onClick={onLeaveRoom}>
            Salir de la sala
          </button>
        )}
      </section>
    );
  }

  return (
    <div className="online-lobby">
      <div className="online-field">
        <label htmlFor={`${baseId}-player-name`} className="online-field__label">
          Tu nombre
        </label>
        <input
          id={`${baseId}-player-name`}
          type="text"
          className="online-input"
          value={playerName}
          onChange={(event) => setPlayerName(event.target.value)}
          placeholder="Ej. Ana"
          maxLength={24}
          autoComplete="name"
        />
      </div>

      {error && (
        <p className="error-alert" role="alert">
          {error}
        </p>
      )}

      <form className="online-section" onSubmit={handleCreateSubmit}>
        <RadioSelectorGroup
          legend="Puntaje objetivo"
          name={`${baseId}-online-target-score`}
          options={TARGET_SCORE_OPTIONS}
          selectedValue={targetScore}
          onChange={setTargetScore}
        />

        <button type="submit" className="play-button" disabled={loading}>
          Crear sala
        </button>
      </form>

      <form className="online-section" onSubmit={handleJoinSubmit}>
        <div className="online-field">
          <label htmlFor={`${baseId}-room-code`} className="online-field__label">
            Código de sala
          </label>
          <input
            id={`${baseId}-room-code`}
            type="text"
            className="online-input online-input--code"
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value)}
            placeholder="Ej. K7M9P"
            maxLength={10}
            autoCapitalize="characters"
            autoComplete="off"
          />
        </div>

        <button type="submit" className="secondary-button" disabled={loading}>
          Unirse a sala
        </button>
      </form>
    </div>
  );
}
