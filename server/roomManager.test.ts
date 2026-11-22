// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createDeck } from '../shared/deck';
import { createGame } from '../shared/engine';
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
