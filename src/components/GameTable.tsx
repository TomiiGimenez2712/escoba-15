import { useEffect, useRef, useState } from 'react';
import type {
  Card,
  GameState,
  LastAction,
  PlayAction,
  PlayerGameView,
} from '../../shared/types';
import {
  playCaptureSound,
  playCardSelectSound,
  playDealSound,
  playDiscardSound,
  playEscobaSound,
  playVictorySound,
  setBackgroundMusicMuted,
  stopBackgroundMusic,
  unlockAudio,
} from '../utils/sound';
import { RulesModal } from './RulesModal';
import { SpanishCard } from './SpanishCard';
import { TrucoScore } from './TrucoScore';

export interface GameTableProps {
  game: GameState | PlayerGameView;
  localPlayerId?: string;
  modeLabel?: string;
  onPlayAction?: (action: PlayAction) => void;
  onExit?: () => void;
}

interface HistoryEntry {
  key: string;
  playerName: string;
  verb: 'capturó' | 'descartó';
  summaryCards: string;
  madeEscoba: boolean;
}

function getLastActionKey(lastAction: LastAction | null): string | null {
  if (!lastAction) {
    return null;
  }
  const capturedIds = lastAction.capturedCards.map((card) => card.id).join(',');
  return `${lastAction.playerId}|${lastAction.type}|${lastAction.playedCard.id}|${capturedIds}|${lastAction.madeEscoba ? '1' : '0'}`;
}

function formatCardLabel(card: Card): string {
  return `${card.number} de ${card.suit}`;
}

function capitalizeSuit(suit: Card['suit']): string {
  return suit.charAt(0).toUpperCase() + suit.slice(1);
}

function formatCompactCard(card: Card): string {
  return `${card.number} ${capitalizeSuit(card.suit)}`;
}

function formatLastAction(lastAction: LastAction): string {
  const played = formatCardLabel(lastAction.playedCard);
  if (lastAction.type === 'capture') {
    const captured = lastAction.capturedCards.map(formatCardLabel).join(', ');
    return `${lastAction.playerName} levantó ${captured} con ${played}`;
  }
  return `${lastAction.playerName} tiró ${played}`;
}

function getTeamName(teamId: 0 | 1): string {
  return teamId === 0 ? 'Equipo A' : 'Equipo B';
}

function getOpponentTeamMeta(
  opponentTeamId: 0 | 1 | undefined,
  localTeamId: 0 | 1 | undefined,
): { label: string; isPartner: boolean } | null {
  if (opponentTeamId === undefined || localTeamId === undefined) {
    return null;
  }
  const isPartner = opponentTeamId === localTeamId;
  const teamName = getTeamName(opponentTeamId);
  return {
    label: isPartner ? `${teamName} · Pareja` : teamName,
    isPartner,
  };
}

export function GameTable({
  game,
  localPlayerId,
  modeLabel,
  onPlayAction,
  onExit,
}: GameTableProps) {
  const resolvedLocalPlayerId = localPlayerId ?? game.players[0]?.id;
  const localPlayer =
    game.players.find((player) => player.id === resolvedLocalPlayerId) ?? game.players[0];
  const localHand = localPlayer?.hand ?? [];
  const opponents = game.players.filter((player) => player.id !== localPlayer?.id);
  const deckCount = 'deck' in game ? game.deck.length : game.deckCount;
  const localTeamLabel =
    localPlayer?.teamId !== undefined ? getTeamName(localPlayer.teamId) : null;
  const isTeams2v2 =
    game.players.length === 4 && game.players.every((player) => player.teamId !== undefined);
  const modalityLabel = isTeams2v2
    ? 'Parejas 2v2 · 4 jugadores'
    : `${game.players.length} jugadores`;
  const currentPlayer = game.players[game.currentPlayerIndex];
  const isPlaying = game.phase === 'playing';
  const isLocalTurn = Boolean(
    isPlaying &&
      onPlayAction &&
      currentPlayer &&
      localPlayer &&
      currentPlayer.id === localPlayer.id,
  );

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedTableCardIds, setSelectedTableCardIds] = useState<string[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [showFigureValues, setShowFigureValues] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const soundEnabledRef = useRef(soundEnabled);
  const lastActionKeyRef = useRef<string | null>(null);
  const lastHistoryKeyRef = useRef<string | null>(null);
  const prevPhaseRef = useRef(game.phase);
  const prevRoundRef = useRef(game.round);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    setBackgroundMusicMuted(!musicEnabled);
    if (!musicEnabled) {
      return undefined;
    }

    const handleFirstGesture = () => {
      unlockAudio();
    };

    window.addEventListener('pointerdown', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, [musicEnabled]);

  useEffect(() => {
    return () => {
      stopBackgroundMusic();
    };
  }, []);

  const handSignature = localHand.map((card) => card.id).join(',');

  useEffect(() => {
    setSelectedCardId(null);
    setSelectedTableCardIds([]);
  }, [handSignature, isLocalTurn, game.round]);

  useEffect(() => {
    if (prevRoundRef.current !== game.round) {
      playDealSound({ muted: !soundEnabledRef.current });
      prevRoundRef.current = game.round;
    }
  }, [game.round]);

  const lastActionKey = getLastActionKey(game.lastAction);

  useEffect(() => {
    if (!game.lastAction || !lastActionKey) {
      lastActionKeyRef.current = null;
      return;
    }

    if (lastActionKeyRef.current === lastActionKey) {
      return;
    }

    lastActionKeyRef.current = lastActionKey;
    const options = { muted: !soundEnabledRef.current };

    if (game.lastAction.type === 'discard') {
      playDiscardSound(options);
    } else if (game.lastAction.madeEscoba) {
      playEscobaSound(options);
    } else {
      playCaptureSound(options);
    }
  }, [lastActionKey, game.lastAction]);

  useEffect(() => {
    const action = game.lastAction;
    if (!action || !lastActionKey) {
      lastHistoryKeyRef.current = null;
      setHistory((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const roundKey = `${game.round}|${lastActionKey}`;
    if (lastHistoryKeyRef.current === roundKey) {
      return;
    }

    lastHistoryKeyRef.current = roundKey;
    const playedSummary = formatCompactCard(action.playedCard);
    const summaryCards =
      action.type === 'capture'
        ? `${playedSummary} → ${action.capturedCards.map(formatCompactCard).join(', ')}`
        : playedSummary;
    const newEntry: HistoryEntry = {
      key: roundKey,
      playerName: action.playerName,
      verb: action.type === 'capture' ? 'capturó' : 'descartó',
      summaryCards,
      madeEscoba: action.madeEscoba,
    };

    setHistory((prev) =>
      prev.some((entry) => entry.key === roundKey) ? prev : [...prev, newEntry],
    );
  }, [game.lastAction, game.round, lastActionKey]);

  useEffect(() => {
    if (prevPhaseRef.current !== 'game_over' && game.phase === 'game_over') {
      playVictorySound({ muted: !soundEnabledRef.current });
    }
    prevPhaseRef.current = game.phase;
  }, [game.phase]);

  const selectedCard = isLocalTurn
    ? (localHand.find((card) => card.id === selectedCardId) ?? null)
    : null;
  const tableIdSet = new Set(game.table.map((card) => card.id));
  const activeTableIds = isLocalTurn
    ? selectedTableCardIds.filter((cardId) => tableIdSet.has(cardId))
    : [];
  const selectedTableIdSet = new Set(activeTableIds);
  const selectedTableCards = game.table.filter((card) => selectedTableIdSet.has(card.id));
  const selectedTableSum = selectedTableCards.reduce((sum, card) => sum + card.value, 0);
  const totalSelectedSum = (selectedCard?.value ?? 0) + selectedTableSum;
  const canCapture = Boolean(selectedCard && selectedTableCards.length > 0 && totalSelectedSum === 15);

  const clearSelection = () => {
    setSelectedCardId(null);
    setSelectedTableCardIds([]);
  };

  const handleSelectCard = (cardId: string) => {
    if (!isLocalTurn) {
      return;
    }
    unlockAudio();
    playCardSelectSound({ muted: !soundEnabledRef.current });
    setSelectedCardId((prev) => {
      if (prev === cardId) {
        setSelectedTableCardIds([]);
        return null;
      }
      return cardId;
    });
  };

  const handleToggleTableCard = (cardId: string) => {
    if (!isLocalTurn) {
      return;
    }
    unlockAudio();
    playCardSelectSound({ muted: !soundEnabledRef.current });
    setSelectedTableCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId],
    );
  };

  const handleDiscard = () => {
    if (!selectedCard || !onPlayAction || !isLocalTurn) {
      return;
    }
    unlockAudio();
    onPlayAction({ type: 'discard', cardId: selectedCard.id });
    clearSelection();
  };

  const handleCapture = () => {
    if (!selectedCard || !canCapture || !onPlayAction || !isLocalTurn) {
      return;
    }
    unlockAudio();
    onPlayAction({
      type: 'capture',
      cardId: selectedCard.id,
      tableCardIds: selectedTableCards.map((card) => card.id),
    });
    clearSelection();
  };

  return (
    <div className="game-table">
      <header className="table-topbar">
        <div className="table-topbar__meta">
          <span className="topbar-pill">{`Ronda ${game.round}`}</span>{' '}
          <span className="topbar-pill">{`Meta ${game.targetScore}`}</span>
        </div>
        <div className="table-topbar__actions">
          <button
            type="button"
            className={`topbar-button ${showFigureValues ? 'topbar-button--active' : ''}`.trim()}
            aria-pressed={showFigureValues}
            onClick={() => setShowFigureValues((prev) => !prev)}
          >
            Valores
          </button>
          <button
            type="button"
            className={`topbar-button ${soundEnabled ? 'topbar-button--active' : ''}`.trim()}
            aria-pressed={soundEnabled}
            onClick={() => {
              unlockAudio();
              setSoundEnabled((prev) => !prev);
            }}
          >
            Sonido
          </button>
          <button
            type="button"
            className={`topbar-button ${musicEnabled ? 'topbar-button--active' : ''}`.trim()}
            aria-pressed={musicEnabled}
            onClick={() => {
              unlockAudio();
              setMusicEnabled((prev) => !prev);
            }}
          >
            Música
          </button>
          <button
            type="button"
            className="topbar-button"
            onClick={() => setRulesOpen(true)}
          >
            Reglas
          </button>
          {onExit && (
            <button
              type="button"
              className="topbar-button topbar-button--exit"
              onClick={onExit}
            >
              Salir
            </button>
          )}
        </div>
      </header>
      <div className="table-felt">
        <section
          className="table-zone table-zone--rival"
          role="region"
          aria-label="Rival"
        >
          <span className="zone-label">Rival</span>
          <div
            className={`opponent-seats ${opponents.length > 1 ? 'opponent-seats--multi' : ''}`.trim()}
          >
            {opponents.map((opponent) => {
              const teamMeta = getOpponentTeamMeta(opponent.teamId, localPlayer?.teamId);
              const hiddenCount = opponent.hand
                ? opponent.hand.length
                : 'handCount' in opponent
                  ? opponent.handCount
                  : 0;

              return (
                <div
                  key={opponent.id}
                  className={`opponent-seat ${teamMeta?.isPartner ? 'opponent-seat--partner' : ''}`.trim()}
                >
                  <div className="opponent-seat__header">
                    <span className="opponent-seat__name">{opponent.name}</span>
                    {teamMeta && (
                      <span
                        className={`team-badge ${
                          teamMeta.isPartner ? 'team-badge--partner' : 'team-badge--rival'
                        }`}
                      >
                        {teamMeta.label}
                      </span>
                    )}
                  </div>
                  <div className="opponent-hand">
                    {Array.from({ length: hiddenCount }, (_, index) => (
                      <SpanishCard key={`${opponent.id}-back-${index}`} faceDown compact />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="table-status">
          {currentPlayer && (
            <div className="turn-indicator">Turno: {currentPlayer.name}</div>
          )}
          {game.lastAction && (
            <div className="last-action-bar">
              <p className="last-action-summary">{formatLastAction(game.lastAction)}</p>
              {game.lastAction.madeEscoba && (
                <span className="escoba-banner">¡ESCOBA!</span>
              )}
            </div>
          )}
        </div>

        <div className="table-middle">
          <section
            className="table-zone table-zone--deck"
            role="region"
            aria-label="Mazo"
          >
            <span className="zone-label">Mazo</span>
            <div className="deck-stack">
              {deckCount > 0 ? (
                <SpanishCard faceDown compact />
              ) : (
                <div className="deck-empty" aria-hidden="true" />
              )}
              <span className="deck-count">{deckCount}</span>
            </div>
          </section>

          <section
            className="table-zone table-zone--mesa"
            role="region"
            aria-label="Mesa"
          >
            <span className="zone-label">Mesa</span>
            {game.escobaDeMano > 0 && (
              <div className="escoba-mano-banner" role="status">
                ¡Escoba de mano!{game.escobaDeMano === 2 ? ' (Doble)' : ''}
              </div>
            )}
            <div className="card-row card-row--mesa">
              {game.table.map((card) => (
                <SpanishCard
                  key={card.id}
                  card={card}
                  selected={selectedTableIdSet.has(card.id)}
                  disabled={!isPlaying || (onPlayAction ? !isLocalTurn : false)}
                  showFigureValues={showFigureValues}
                  onClick={onPlayAction ? () => handleToggleTableCard(card.id) : undefined}
                />
              ))}
            </div>
          </section>
        </div>

        {isLocalTurn && onPlayAction && (selectedCard || selectedTableCards.length > 0) && (
          <div className="action-bar">
            {selectedCard && selectedTableCards.length > 0 ? (
              <p className="selection-sum">
                {`Suma elegida: ${totalSelectedSum} / 15`}
              </p>
            ) : selectedCard ? (
              <p className="selection-hint">
                Tocá cartas de la mesa para sumar 15 o tirá tu carta.
              </p>
            ) : (
              <p className="selection-hint">
                Elegí una carta de tu mano para completar 15.
              </p>
            )}
            <div className="action-buttons">
              {selectedCard && selectedTableCards.length > 0 && (
                <button
                  type="button"
                  className="action-button action-button--capture"
                  onClick={handleCapture}
                  disabled={!canCapture}
                >
                  Levantar (15)
                </button>
              )}
              {selectedCard ? (
                <button
                  type="button"
                  className="action-button action-button--discard"
                  onClick={handleDiscard}
                >
                  Tirar a la mesa
                </button>
              ) : (
                <button
                  type="button"
                  className="action-button action-button--discard"
                  onClick={() => setSelectedTableCardIds([])}
                >
                  Limpiar mesa
                </button>
              )}
            </div>
          </div>
        )}

        <section
          className="table-zone table-zone--player"
          role="region"
          aria-label="Tu mano"
        >
          <div className="player-zone-header">
            <span className="zone-label">Tu mano</span>
            {localTeamLabel && (
              <span className="team-badge team-badge--partner">{localTeamLabel}</span>
            )}
          </div>
          <div className="card-row card-row--player">
            {localHand.map((card) => (
              <SpanishCard
                key={card.id}
                card={card}
                selected={selectedCard?.id === card.id}
                disabled={!isPlaying || (onPlayAction ? !isLocalTurn : false)}
                showFigureValues={showFigureValues}
                onClick={onPlayAction ? () => handleSelectCard(card.id) : undefined}
              />
            ))}
          </div>
        </section>
      </div>

      <aside className="table-sidebar">
        <section
          className="side-card side-card--scoreboard"
          role="region"
          aria-label="Marcador"
        >
          <div className="side-card__header">
            <h2 className="side-card__title">Marcador</h2>{' '}
            <div className="side-card__badges">
              <span className="scoreboard-meta">{modalityLabel}</span>
              {modeLabel && (
                <>
                  {' '}
                  <span className="scoreboard-meta">{modeLabel}</span>
                </>
              )}
            </div>
          </div>
          <ul className="scoreboard-list">
            {game.players.map((player) => {
              const escobasLabel = `${player.escobas} ${player.escobas === 1 ? 'escoba' : 'escobas'}`;
              const cardsLabel = `${player.captured.length} ${player.captured.length === 1 ? 'carta' : 'cartas'}`;
              return (
                <li key={player.id} className="scoreboard-item">
                  <div className="scoreboard-item__main">
                    <span className="scoreboard-item__name">{player.name}</span>
                    {player.teamId !== undefined && (
                      <>
                        {' '}
                        <span
                          className={`team-badge ${
                            player.teamId === localPlayer?.teamId
                              ? 'team-badge--partner'
                              : 'team-badge--rival'
                          }`}
                        >
                          {getTeamName(player.teamId)}
                        </span>
                      </>
                    )}
                  </div>{' '}
                  <div className="scoreboard-item__truco">
                    <TrucoScore score={player.score} />
                  </div>
                  <div className="scoreboard-item__stats">
                    <span className="scoreboard-item__score">{`${player.score} pts`}</span>{' '}
                    <span>{escobasLabel}</span>{' '}
                    <span>{cardsLabel}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          className="side-card side-card--history"
          role="region"
          aria-label="Historial de jugadas"
        >
          <div className="side-card__header">
            <h2 className="side-card__title">Historial de jugadas</h2>
          </div>
          {history.length === 0 ? (
            <p className="history-empty">Sin jugadas en esta ronda.</p>
          ) : (
            <ol className="history-list">
              {history.map((entry) => (
                <li key={entry.key} className="history-item">
                  <span className="history-item__player">{entry.playerName}</span>{' '}
                  <span className="history-item__action">{entry.verb}</span>{' '}
                  <span className="history-item__cards">{entry.summaryCards}</span>
                  {entry.madeEscoba && (
                    <>
                      {' '}
                      <span className="history-escoba-badge">Escoba</span>
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </aside>
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}

export default GameTable;
