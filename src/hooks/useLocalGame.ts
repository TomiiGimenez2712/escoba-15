import { useEffect, useState } from 'react';
import { chooseAiMove } from '../../shared/ai';
import { createGame, playCard, startNextRound } from '../../shared/engine';
import type {
  BotDifficulty,
  GameState,
  PlayAction,
  PlayerConfig,
  TargetScore,
} from '../../shared/types';

export type PlayerCount = 2 | 3 | 4;

export interface UseLocalGameOptions {
  initialGame?: GameState | null;
  botDelayMs?: number;
}

const DEFAULT_BOT_DELAY_MS = 650;

/** Construye la configuración de asientos con el jugador humano en el índice 0. */
function buildPlayers(playerCount: PlayerCount): PlayerConfig[] {
  const players: PlayerConfig[] = [{ id: 'player-1', name: 'Tú', isBot: false }];

  if (playerCount === 2) {
    players.push({ id: 'bot-1', name: 'Bot', isBot: true });
    return players;
  }

  for (let index = 1; index < playerCount; index += 1) {
    players.push({
      id: `bot-${index}`,
      name: `Bot ${index}`,
      isBot: true,
    });
  }

  return players;
}

/** Gestiona el estado local de la partida, configuración inicial y turnos automáticos de bots. */
export function useLocalGame({
  initialGame = null,
  botDelayMs = DEFAULT_BOT_DELAY_MS,
}: UseLocalGameOptions = {}) {
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medio');
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [targetScore, setTargetScore] = useState<TargetScore>(15);
  const [game, setGame] = useState<GameState | null>(initialGame);

  const startGame = () => {
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
    setGame((prev) => (prev && prev.phase === 'round_end' ? startNextRound(prev) : prev));
  };

  const rematch = () => {
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

  useEffect(() => {
    if (!game || game.phase !== 'playing') {
      return undefined;
    }

    const activePlayer = game.players[game.currentPlayerIndex];
    if (!activePlayer || !activePlayer.isBot) {
      return undefined;
    }

    const timerId = setTimeout(() => {
      setGame((prev) => {
        if (!prev || prev.phase !== 'playing') {
          return prev;
        }
        const currentBot = prev.players[prev.currentPlayerIndex];
        if (!currentBot || !currentBot.isBot) {
          return prev;
        }
        const move = chooseAiMove(prev, currentBot.id, difficulty);
        return playCard(prev, currentBot.id, move);
      });
    }, botDelayMs);

    return () => {
      clearTimeout(timerId);
    };
  }, [game, difficulty, botDelayMs]);

  return {
    difficulty,
    setDifficulty,
    playerCount,
    setPlayerCount,
    targetScore,
    setTargetScore,
    game,
    startGame,
    playAction,
    nextRound,
    rematch,
  };
}
