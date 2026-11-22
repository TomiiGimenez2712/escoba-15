// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createDeck } from '../shared/deck';
import { createGame, findCaptureCombinations } from '../shared/engine';
import type { PlayAction, PlayerGameView } from '../shared/types';
import { RoomManager, buildPlayerGameView } from './roomManager';

const ROOM_CODE_REGEX = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;

describe('server/roomManager — RoomManager (micro-test #1)', () => {
  it('crea salas con validaciones, código de 5 caracteres sin ambigüedad e ids/tokens únicos', () => {
    const manager = new RoomManager();

    expect(() => manager.createRoom({ playerName: '' })).toThrow();
    expect(() => manager.createRoom({ playerName: '   ' })).toThrow();

    const first = manager.createRoom({ playerName: '  Ana  ' });
    const second = manager.createRoom({ playerName: 'Beto', targetScore: 21 });

    expect(first.snapshot.code).toMatch(ROOM_CODE_REGEX);
    expect(second.snapshot.code).toMatch(ROOM_CODE_REGEX);
    expect(first.snapshot.code).not.toBe(second.snapshot.code);

    expect(first.snapshot.status).toBe('waiting');
    expect(first.snapshot.maxPlayers).toBe(2);
    expect(first.snapshot.targetScore).toBe(15);
    expect(second.snapshot.targetScore).toBe(21);
    expect(first.snapshot.gameView).toBeNull();

    expect(first.snapshot.selfPlayerId).toBeTruthy();
    expect(first.sessionToken).toBeTruthy();
    expect(first.snapshot.selfPlayerId).not.toBe(second.snapshot.selfPlayerId);
    expect(first.sessionToken).not.toBe(second.sessionToken);

    expect(first.snapshot.players).toEqual([
      {
        id: first.snapshot.selfPlayerId,
        name: 'Ana',
        connected: true,
      },
    ]);
  });

  it('normaliza código al unirse, inicia con dealerIndex = players.length - 1 y rechaza errores sin mutar', () => {
    const manager = new RoomManager();
    const created = manager.createRoom({ playerName: 'Ana', targetScore: 21 });
    const code = created.snapshot.code;

    expect(() => manager.joinRoom({ code, playerName: '   ' })).toThrow();
    expect(() => manager.joinRoom({ code: 'ZZZZZ', playerName: 'Beto' })).toThrow();

    const waitingBeforeJoin = manager.getRoomSnapshotForPlayer(code, created.snapshot.selfPlayerId);
    expect(waitingBeforeJoin.status).toBe('waiting');
    expect(waitingBeforeJoin.players).toHaveLength(1);

    const joined = manager.joinRoom({
      code: `  ${code.toLowerCase()}  `,
      playerName: 'Beto',
    });

    expect(joined.sessionToken).toBeTruthy();
    expect(joined.sessionToken).not.toBe(created.sessionToken);
    expect(joined.snapshot.code).toBe(code);
    expect(joined.snapshot.status).toBe('playing');
    expect(joined.snapshot.players).toHaveLength(2);
    expect(joined.snapshot.gameView).not.toBeNull();
    expect(joined.snapshot.gameView?.dealerIndex).toBe(1);
    expect(joined.snapshot.gameView?.currentPlayerIndex).toBe(0);

    expect(() => manager.joinRoom({ code, playerName: 'Carla' })).toThrow();

    const afterRejectedJoin = manager.getRoomSnapshotForPlayer(code, created.snapshot.selfPlayerId);
    expect(afterRejectedJoin.status).toBe('playing');
    expect(afterRejectedJoin.players).toHaveLength(2);
  });

  it('filtra deck y manos rivales en getRoomSnapshotForPlayer y buildPlayerGameView', () => {
    const manager = new RoomManager();
    const p1 = manager.createRoom({ playerName: 'Ana' });
    const p2 = manager.joinRoom({ code: p1.snapshot.code, playerName: 'Beto' });

    const p1Id = p1.snapshot.selfPlayerId;
    const p2Id = p2.snapshot.selfPlayerId;

    const p1Snap = manager.getRoomSnapshotForPlayer(p1.snapshot.code, p1Id);
    const p2Snap = manager.getRoomSnapshotForPlayer(p1.snapshot.code, p2Id);

    expect(p1Snap.gameView).not.toBeNull();
    expect(p2Snap.gameView).not.toBeNull();

    const p1View = p1Snap.gameView!;
    const p2View = p2Snap.gameView!;

    expect(p1View.localPlayerId).toBe(p1Id);
    expect(p1View.deckCount).toBe(30);
    expect('deck' in p1View).toBe(false);

    const p1SelfInP1View = p1View.players.find((pl) => pl.id === p1Id)!;
    const p2RivalInP1View = p1View.players.find((pl) => pl.id === p2Id)!;
    expect(p1SelfInP1View.hand).toHaveLength(3);
    expect(p1SelfInP1View.handCount).toBe(3);
    expect(p2RivalInP1View.hand).toBeUndefined();
    expect('hand' in p2RivalInP1View).toBe(false);
    expect(p2RivalInP1View.handCount).toBe(3);

    const p1RivalInP2View = p2View.players.find((pl) => pl.id === p1Id)!;
    const p2SelfInP2View = p2View.players.find((pl) => pl.id === p2Id)!;
    expect(p2SelfInP2View.hand).toHaveLength(3);
    expect(p1RivalInP2View.hand).toBeUndefined();
    expect('hand' in p1RivalInP2View).toBe(false);
    expect(p1RivalInP2View.handCount).toBe(3);

    const state = createGame({
      players: [
        { id: 'p1', name: 'Ana' },
        { id: 'p2', name: 'Beto' },
      ],
      dealerIndex: 1,
      deck: createDeck(),
    });
    const directView = buildPlayerGameView(state, 'p1', { p1: true, p2: false });

    expect(directView.localPlayerId).toBe('p1');
    expect(directView.deckCount).toBe(30);
    expect('deck' in directView).toBe(false);
    expect(directView.players[0].hand).toEqual(state.players[0].hand);
    expect(directView.players[0].handCount).toBe(3);
    expect(directView.players[0].connected).toBe(true);
    expect(directView.players[1].hand).toBeUndefined();
    expect('hand' in directView.players[1]).toBe(false);
    expect(directView.players[1].handCount).toBe(3);
    expect(directView.players[1].connected).toBe(false);
  });
});

describe('server/roomManager — H6 ciclo de partida y reconexión (micro-test #1)', () => {
  function setupTwoPlayerRoom(manager: RoomManager) {
    const p1 = manager.createRoom({ playerName: 'Ana', targetScore: 15 });
    const code = p1.snapshot.code;
    const p2 = manager.joinRoom({ code, playerName: 'Beto' });

    return {
      code,
      p1Id: p1.snapshot.selfPlayerId,
      p2Id: p2.snapshot.selfPlayerId,
      p1Token: p1.sessionToken,
      p2Token: p2.sessionToken,
    };
  }

  function pickLegalAction(view: PlayerGameView): PlayAction {
    const currentPlayer = view.players[view.currentPlayerIndex];
    const hand = currentPlayer.hand ?? [];
    const card = hand[0];
    if (!card) {
      throw new Error(`El jugador ${currentPlayer.id} no tiene cartas en mano.`);
    }

    const combinations = findCaptureCombinations(card, view.table);
    if (combinations.length > 0) {
      return {
        type: 'capture',
        cardId: card.id,
        tableCardIds: combinations[0].map((tableCard) => tableCard.id),
      };
    }

    return { type: 'discard', cardId: card.id };
  }

  function playRoundToEnd(manager: RoomManager, code: string, probePlayerId: string) {
    let snapshot = manager.getRoomSnapshotForPlayer(code, probePlayerId);
    for (let step = 0; step < 50 && snapshot.gameView?.phase === 'playing'; step += 1) {
      const currentPlayerId = snapshot.gameView.players[snapshot.gameView.currentPlayerIndex].id;
      const turnView = manager.getRoomSnapshotForPlayer(code, currentPlayerId).gameView!;
      snapshot = manager.playMove({
        code,
        playerId: currentPlayerId,
        action: pickLegalAction(turnView),
      });
    }
    return snapshot;
  }

  function playUntilGameOver(manager: RoomManager, code: string, probePlayerId: string) {
    let snapshot = playRoundToEnd(manager, code, probePlayerId);
    for (let roundGuard = 0; roundGuard < 25 && snapshot.gameView?.phase === 'round_end'; roundGuard += 1) {
      manager.nextRound({ code, playerId: probePlayerId });
      snapshot = playRoundToEnd(manager, code, probePlayerId);
    }
    return snapshot;
  }

  it('valida playMove en sala playing, pertenencia, turno y oculta manos rivales sin mutar en error', () => {
    const manager = new RoomManager();
    const waiting = manager.createRoom({ playerName: 'Ana' });
    const code = waiting.snapshot.code;
    const p1Id = waiting.snapshot.selfPlayerId;

    expect(() =>
      manager.playMove({ code, playerId: p1Id, action: { type: 'discard', cardId: 'oros-1' } })
    ).toThrow();

    const p2 = manager.joinRoom({ code, playerName: 'Beto' });
    const p2Id = p2.snapshot.selfPlayerId;

    const p1SnapBefore = manager.getRoomSnapshotForPlayer(code, p1Id);
    const p2SnapBefore = manager.getRoomSnapshotForPlayer(code, p2Id);
    const validAction = pickLegalAction(p1SnapBefore.gameView!);
    const p2CardId = p2SnapBefore.gameView!.players[1].hand![0].id;

    expect(() =>
      manager.playMove({ code, playerId: 'ajeno', action: validAction })
    ).toThrow();
    expect(() =>
      manager.playMove({ code, playerId: p2Id, action: { type: 'discard', cardId: p2CardId } })
    ).toThrow();
    expect(() =>
      manager.playMove({ code, playerId: p1Id, action: { type: 'discard', cardId: 'carta-falsa' } })
    ).toThrow();

    const unchangedView = manager.getRoomSnapshotForPlayer(code, p1Id).gameView!;
    expect(unchangedView.currentPlayerIndex).toBe(0);
    expect(unchangedView.lastAction).toBeNull();
    expect(unchangedView.players[0].handCount).toBe(3);

    const afterMove = manager.playMove({ code, playerId: p1Id, action: validAction });
    const p1ViewAfter = afterMove.gameView!;
    const p2ViewAfter = manager.getRoomSnapshotForPlayer(code, p2Id).gameView!;

    expect(afterMove.selfPlayerId).toBe(p1Id);
    expect(p1ViewAfter.currentPlayerIndex).toBe(1);
    expect(p1ViewAfter.lastAction?.playerId).toBe(p1Id);
    expect(p1ViewAfter.lastAction?.playedCard.id).toBe(validAction.cardId);

    expect(p1ViewAfter.players[0].hand).toHaveLength(2);
    expect(p1ViewAfter.players[0].handCount).toBe(2);
    expect(p1ViewAfter.players[1].hand).toBeUndefined();
    expect('hand' in p1ViewAfter.players[1]).toBe(false);
    expect(p1ViewAfter.players[1].handCount).toBe(3);

    expect(p2ViewAfter.players[0].hand).toBeUndefined();
    expect('hand' in p2ViewAfter.players[0]).toBe(false);
    expect(p2ViewAfter.players[1].hand).toHaveLength(3);
  });

  it('rechaza nextRound antes de round_end y al completar ronda avanza conservando puntajes y rotando dealerIndex', () => {
    const manager = new RoomManager();
    const waiting = manager.createRoom({ playerName: 'Ana' });
    const code = waiting.snapshot.code;
    const p1Id = waiting.snapshot.selfPlayerId;

    expect(() => manager.nextRound({ code, playerId: p1Id })).toThrow();

    const p2 = manager.joinRoom({ code, playerName: 'Beto' });
    const p2Id = p2.snapshot.selfPlayerId;

    expect(() => manager.nextRound({ code, playerId: p1Id })).toThrow();

    const roundEndSnap = playRoundToEnd(manager, code, p1Id);
    expect(roundEndSnap.gameView?.phase).toBe('round_end');

    expect(() =>
      manager.playMove({ code, playerId: p1Id, action: { type: 'discard', cardId: 'oros-1' } })
    ).toThrow();
    expect(() => manager.nextRound({ code, playerId: 'ajeno' })).toThrow();

    const accumulatedScores = roundEndSnap.gameView!.players.map((player) => player.score);
    const nextSnap = manager.nextRound({ code, playerId: p2Id });

    expect(nextSnap.gameView?.phase).toBe('playing');
    expect(nextSnap.gameView?.round).toBe(2);
    expect(nextSnap.gameView?.dealerIndex).toBe(0);
    expect(nextSnap.gameView?.players.map((player) => player.score)).toEqual(accumulatedScores);
    expect(nextSnap.gameView?.players.every((player) => player.handCount === 3)).toBe(true);
  });

  it('rechaza rematch antes de game_over y al llegar a game_over reinicia manteniendo sala, jugadores y tokens', () => {
    const manager = new RoomManager();
    const { code, p1Id, p2Id, p1Token, p2Token } = setupTwoPlayerRoom(manager);

    expect(() => manager.rematch({ code, playerId: p1Id })).toThrow();

    const roundEndSnap = playRoundToEnd(manager, code, p1Id);
    expect(roundEndSnap.gameView?.phase).toBe('round_end');
    expect(() => manager.rematch({ code, playerId: p1Id })).toThrow();

    manager.nextRound({ code, playerId: p1Id });
    const gameOverSnap = playUntilGameOver(manager, code, p1Id);
    expect(gameOverSnap.gameView?.phase).toBe('game_over');

    expect(() => manager.rematch({ code, playerId: 'ajeno' })).toThrow();

    const rematchSnap = manager.rematch({ code, playerId: p1Id });
    expect(rematchSnap.code).toBe(code);
    expect(rematchSnap.status).toBe('playing');
    expect(rematchSnap.players.map((player) => ({ id: player.id, name: player.name }))).toEqual([
      { id: p1Id, name: 'Ana' },
      { id: p2Id, name: 'Beto' },
    ]);
    expect(rematchSnap.gameView?.phase).toBe('playing');
    expect(rematchSnap.gameView?.round).toBe(1);
    expect(rematchSnap.gameView?.dealerIndex).toBe(1);
    expect(rematchSnap.gameView?.players.every((player) => player.score === 0)).toBe(true);

    expect(manager.reconnect({ code, sessionToken: p1Token }).selfPlayerId).toBe(p1Id);
    expect(manager.reconnect({ code, sessionToken: p2Token }).selfPlayerId).toBe(p2Id);
  });

  it('gestiona detachSocket, reconnect normalizando código/token y cleanupExpiredRooms por TTL', () => {
    const manager = new RoomManager();
    const { code, p1Id, p2Id, p1Token } = setupTwoPlayerRoom(manager);

    const activeRoom = manager.createRoom({ playerName: 'Clara' });
    manager.attachSocket('s-active', activeRoom.snapshot.code, activeRoom.snapshot.selfPlayerId);

    manager.attachSocket('s1-a', code, p1Id);
    manager.attachSocket('s1-b', code, p1Id);
    manager.attachSocket('s2', code, p2Id);

    expect(manager.detachSocket('socket-inexistente')).toBeNull();
    expect(manager.detachSocket('s1-a')).toEqual({
      code,
      playerId: p1Id,
      becameDisconnected: false,
    });
    expect(
      manager.getRoomSnapshotForPlayer(code, p1Id).players.find((player) => player.id === p1Id)
        ?.connected
    ).toBe(true);

    expect(manager.detachSocket('s1-b')).toEqual({
      code,
      playerId: p1Id,
      becameDisconnected: true,
    });
    const afterDisconnectSnap = manager.getRoomSnapshotForPlayer(code, p2Id);
    expect(afterDisconnectSnap.players.find((player) => player.id === p1Id)?.connected).toBe(false);
    expect(
      afterDisconnectSnap.gameView?.players.find((player) => player.id === p1Id)?.connected
    ).toBe(false);

    expect(() => manager.reconnect({ code, sessionToken: 'token-invalido' })).toThrow();
    expect(() => manager.reconnect({ code: 'ZZZZZ', sessionToken: p1Token })).toThrow();

    const reconnected = manager.reconnect({
      code: `  ${code.toLowerCase()}  `,
      sessionToken: p1Token,
    });
    expect(reconnected.code).toBe(code);
    expect(reconnected.selfPlayerId).toBe(p1Id);
    expect(reconnected.sessionToken).toBe(p1Token);
    expect(reconnected.players.find((player) => player.id === p1Id)?.connected).toBe(true);
    expect(reconnected.gameView?.players.find((player) => player.id === p1Id)?.connected).toBe(true);

    expect(manager.detachSocket('s2')).toEqual({
      code,
      playerId: p2Id,
      becameDisconnected: true,
    });
    expect(manager.cleanupExpiredRooms(60_000, Date.now() + 1_000_000)).toEqual([]);

    manager.attachSocket('s1-c', code, p1Id);
    const tBeforeEmpty = Date.now();
    expect(manager.detachSocket('s1-c')).toEqual({
      code,
      playerId: p1Id,
      becameDisconnected: true,
    });
    const tAfterEmpty = Date.now();

    expect(manager.cleanupExpiredRooms(60_000, tBeforeEmpty + 59_000)).toEqual([]);
    expect(manager.cleanupExpiredRooms(60_000, tAfterEmpty + 60_000)).toEqual([code]);

    expect(() => manager.getRoomSnapshotForPlayer(code, p1Id)).toThrow();
    expect(
      manager.getRoomSnapshotForPlayer(activeRoom.snapshot.code, activeRoom.snapshot.selfPlayerId)
        .code
    ).toBe(activeRoom.snapshot.code);
  });
});
