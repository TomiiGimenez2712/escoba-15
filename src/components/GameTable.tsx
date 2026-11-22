import { useEffect, useState } from 'react';
import { findCaptureCombinations } from '../../shared/engine';
import type { Card, GameState, LastAction, PlayAction } from '../../shared/types';
import { SpanishCard } from './SpanishCard';

export interface GameTableProps {
  game: GameState;
  localPlayerId?: string;
  onPlayAction?: (action: PlayAction) => void;
}

function formatCardLabel(card: Card): string {
  return `${card.number} de ${card.suit}`;
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

export function GameTable({ game, localPlayerId, onPlayAction }: GameTableProps) {
  const resolvedLocalPlayerId = localPlayerId ?? game.players[0]?.id;
  const localPlayer =
    game.players.find((player) => player.id === resolvedLocalPlayerId) ?? game.players[0];
  const opponents = game.players.filter((player) => player.id !== localPlayer?.id);
  const localTeamLabel =
    localPlayer?.teamId !== undefined ? getTeamName(localPlayer.teamId) : null;
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
  const [selectedComboIndex, setSelectedComboIndex] = useState(0);

  const handSignature = localPlayer?.hand.map((card) => card.id).join(',') ?? '';

  useEffect(() => {
    setSelectedCardId(null);
    setSelectedComboIndex(0);
  }, [handSignature, isLocalTurn]);

  const selectedCard = isLocalTurn
    ? (localPlayer?.hand.find((card) => card.id === selectedCardId) ?? null)
    : null;
  const combinations = selectedCard ? findCaptureCombinations(selectedCard, game.table) : [];
  const activeComboIndex = selectedComboIndex < combinations.length ? selectedComboIndex : 0;
  const activeCombination = combinations[activeComboIndex] ?? null;
  const highlightedCardIds = new Set(
    activeCombination ? activeCombination.map((card) => card.id) : [],
  );

  const clearSelection = () => {
    setSelectedCardId(null);
    setSelectedComboIndex(0);
  };

  const handleSelectCard = (cardId: string) => {
    if (!isLocalTurn) {
      return;
    }
    setSelectedCardId((prev) => (prev === cardId ? null : cardId));
    setSelectedComboIndex(0);
  };

  const handleDiscard = () => {
    if (!selectedCard || !onPlayAction || !isLocalTurn) {
      return;
    }
    onPlayAction({ type: 'discard', cardId: selectedCard.id });
    clearSelection();
  };

  const handleCapture = () => {
    if (!selectedCard || !activeCombination || !onPlayAction || !isLocalTurn) {
      return;
    }
    onPlayAction({
      type: 'capture',
      cardId: selectedCard.id,
      tableCardIds: activeCombination.map((card) => card.id),
    });
    clearSelection();
  };

  return (
    <div className="game-table">
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
                  {opponent.hand.map((card) => (
                    <SpanishCard key={card.id} faceDown compact />
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
            {game.deck.length > 0 ? (
              <SpanishCard faceDown compact />
            ) : (
              <div className="deck-empty" aria-hidden="true" />
            )}
            <span className="deck-count">{game.deck.length}</span>
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
                highlighted={highlightedCardIds.has(card.id)}
              />
            ))}
          </div>
        </section>
      </div>

      {selectedCard && (
        <div className="action-bar">
          {combinations.length > 1 && (
            <div className="combo-chips" role="group" aria-label="Combinaciones posibles">
              {combinations.map((combo, index) => (
                <button
                  key={combo.map((card) => card.id).join('+')}
                  type="button"
                  className={`combo-chip ${index === activeComboIndex ? 'combo-chip--active' : ''}`.trim()}
                  aria-pressed={index === activeComboIndex}
                  onClick={() => setSelectedComboIndex(index)}
                >
                  {combo.map(formatCardLabel).join(' + ')}
                </button>
              ))}
            </div>
          )}
          <div className="action-buttons">
            {activeCombination && (
              <button
                type="button"
                className="action-button action-button--capture"
                onClick={handleCapture}
              >
                Levantar (15)
              </button>
            )}
            <button
              type="button"
              className="action-button action-button--discard"
              onClick={handleDiscard}
            >
              Tirar a la mesa
            </button>
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
          {localPlayer?.hand.map((card) => (
            <SpanishCard
              key={card.id}
              card={card}
              selected={selectedCard?.id === card.id}
              disabled={!isPlaying || (onPlayAction ? !isLocalTurn : false)}
              onClick={onPlayAction ? () => handleSelectCard(card.id) : undefined}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export default GameTable;
