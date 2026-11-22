import { useEffect, useState } from 'react';
import { chooseAiMove } from '../../shared/ai';
import { createGame, playCard, startNextRound } from '../../shared/engine';
import type {
  BotDifficulty,
  Card,
  GameState,
  PlayAction,
  PlayerConfig,
  TargetScore,
} from '../../shared/types';

export type PlayerCount = 2 | 3 | 4;

export interface BotMovePreview {
  playerId: string;
  playerName: string;
  move: PlayAction;
  playedCard: Card;
}

export interface UseLocalGameOptions {
  initialGame?: GameState | null;
  botDelayMs?: number;
  botPreviewDelayMs?: number;
}

const DEFAULT_BOT_DELAY_MS = 450;
const DEFAULT_BOT_PREVIEW_MS = 850;

export const OPPONENT_PERSON_NAMES = [
  'Mateo',
  'Sofía',
  'Lucía',
  'Valentín',
  'Camila',
  'Tomás',
  'Martina',
  'Julián',
  'Joaquín',
  'Mora',
  'Bautista',
  'Catalina',
  'Franco',
  'Abril',
] as const;

function pickRandomOpponentNames(count: number): string[] {
  const pool = [...OPPONENT_PERSON_NAMES];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/** Construye la configuración de asientos con el jugador humano en el índice 0 y nombres reales para los bots. */
function buildPlayers(playerCount: PlayerCount): PlayerConfig[] {
  const players: PlayerConfig[] = [{ id: 'player-1', name: 'Tú', isBot: false }];
  const opponentNames = pickRandomOpponentNames(playerCount - 1);

  for (let index = 1; index < playerCount; index += 1) {
    players.push({
      id: `bot-${index}`,
      name: opponentNames[index - 1] ?? `Jugador ${index + 1}`,
      isBot: true,
    });
  }

  return players;
}

/** Gestiona el estado local de la partida, configuración inicial y turnos animados de bots. */
export function useLocalGame({
  initialGame = null,
  botDelayMs = DEFAULT_BOT_DELAY_MS,
  botPreviewDelayMs = DEFAULT_BOT_PREVIEW_MS,
}: UseLocalGameOptions = {}) {
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medio');
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [targetScore, setTargetScore] = useState<TargetScore>(15);
  const [game, setGame] = useState<GameState | null>(initialGame);
  const [botPreview, setBotPreview] = useState<BotMovePreview | null>(null);

  const startGame = () => {
    setBotPreview(null);
    const players = buildPlayers(playerCount);
    setGame(
      createGame({
        players,
        targetScore,
        dealerIndex: players.length - 1,
      }),
    );
  };

  const playAction = (action: PlayAction) => {
    setBotPreview(null);
    setGame((prev) => {
      if (!prev || prev.phase !== 'playing') {
        return prev;
      }
      const humanPlayer = prev.players[0];
      const currentPlayer = prev.players[prev.currentPlayerIndex];
      if (!humanPlayer || currentPlayer?.id !== humanPlayer.id) {
        return prev;
      }
      return playCard(prev, humanPlayer.id, action);
    });
  };

  const nextRound = () => {
    setBotPreview(null);
    setGame((prev) => (prev && prev.phase === 'round_end' ? startNextRound(prev) : prev));
  };

  const rematch = () => {
    setBotPreview(null);
    setGame((prev) => {
      const players: PlayerConfig[] = prev
        ? prev.players.map((player) => ({
            id: player.id,
            name: player.name,
            isBot: player.isBot,
          }))
        : buildPlayers(playerCount);

      return createGame({
        players,
        targetScore: prev?.targetScore ?? targetScore,
        dealerIndex: players.length - 1,
      });
    });
  };

  const exitGame = () => {
    setBotPreview(null);
    setGame(null);
  };

  useEffect(() => {
    if (!game || game.phase !== 'playing') {
      setBotPreview(null);
      return undefined;
    }

    const activePlayer = game.players[game.currentPlayerIndex];
    if (!activePlayer || !activePlayer.isBot) {
      setBotPreview(null);
      return undefined;
    }

    if (botPreview && botPreview.playerId === activePlayer.id) {
      const commitTimer = setTimeout(() => {
        setGame((prev) => {
          if (!prev || prev.phase !== 'playing') {
            return prev;
          }
          const currentBot = prev.players[prev.currentPlayerIndex];
          if (!currentBot || currentBot.id !== botPreview.playerId) {
            return prev;
          }
          return playCard(prev, currentBot.id, botPreview.move);
        });
        setBotPreview(null);
      }, botPreviewDelayMs);

      return () => {
        clearTimeout(commitTimer);
      };
    }

    const thinkTimer = setTimeout(() => {
      const move = chooseAiMove(game, activePlayer.id, difficulty);
      const playedCard = activePlayer.hand.find((c) => c.id === move.cardId);
      if (!playedCard) {
        setGame((prev) => (prev ? playCard(prev, activePlayer.id, move) : prev));
        return;
      }
      setBotPreview({
        playerId: activePlayer.id,
        playerName: activePlayer.name,
        move,
        playedCard,
      });
    }, botDelayMs);

    return () => {
      clearTimeout(thinkTimer);
    };
  }, [game, botPreview, difficulty, botDelayMs, botPreviewDelayMs]);

  return {
    difficulty,
    setDifficulty,
    playerCount,
    setPlayerCount,
    targetScore,
    setTargetScore,
    game,
    botPreview,
    startGame,
    playAction,
    nextRound,
    rematch,
    exitGame,
  };
}
