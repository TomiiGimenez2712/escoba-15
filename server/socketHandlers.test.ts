// @vitest-environment node
import type { AddressInfo } from 'node:net';
import { io as createClient, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { findCaptureCombinations } from '../shared/engine';
import type { PlayAction, PlayerGameView, RoomSnapshot } from '../shared/types';
import { createServerApp } from './app';

const ROOM_CODE_REGEX = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;

type RoomAck =
  | { ok: true; snapshot: RoomSnapshot }
  | { ok: false; error: string };

describe('server/socketHandlers — HTTP y Socket.IO (micro-test #2)', () => {
  let baseUrl = '';
  let closeServer: (() => Promise<void>) | undefined;
  const activeSockets: Socket[] = [];

  beforeAll(async () => {
    const { httpServer, io } = createServerApp();
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    closeServer = async () => {
      await new Promise<void>((resolve) => io.close(() => resolve()));
      if (httpServer.listening) {
        await new Promise<void>((resolve, reject) =>
          httpServer.close((err) => (err ? reject(err) : resolve()))
        );
      }
    };
  });

  afterEach(() => {
    while (activeSockets.length > 0) {
      activeSockets.pop()?.disconnect();
    }
  });

  afterAll(async () => {
    await closeServer?.();
  });

  async function connectClient(): Promise<Socket> {
    const socket = createClient(baseUrl, {
      transports: ['websocket'],
      reconnection: false,
    });
    activeSockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', (err) => reject(err));
    });
    return socket;
  }

  function onceEvent<T>(socket: Socket, event: string, timeoutMs = 1500): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off(event, onEvent);
        reject(new Error(`Timeout esperando evento ${event}`));
      }, timeoutMs);
      const onEvent = (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      };
      socket.once(event, onEvent);
    });
  }

  function emitAck<T>(
    socket: Socket,
    event: string,
    payload: unknown,
    timeoutMs = 1500
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout esperando ack de ${event}`));
      }, timeoutMs);
      socket.emit(event, payload, (response: T) => {
        clearTimeout(timer);
        resolve(response);
      });
    });
  }

  function pickLegalAction(view: PlayerGameView): PlayAction {
    const currentPlayer = view.players[view.currentPlayerIndex];
    const card = currentPlayer.hand?.[0];
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

  function assertHandPrivacy(snapshot: RoomSnapshot, selfId: string, rivalId: string): void {
    const view = snapshot.gameView!;
    expect('deck' in view).toBe(false);
    const self = view.players.find((player) => player.id === selfId)!;
    const rival = view.players.find((player) => player.id === rivalId)!;
    expect(self.hand).toHaveLength(self.handCount);
    expect(rival.hand).toBeUndefined();
    expect('hand' in rival).toBe(false);
  }

  it('responde health check y gestiona creación, unión, privacidad por jugador y errores en Socket.IO', async () => {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    expect(healthRes.status).toBe(200);
    expect(await healthRes.json()).toEqual({ ok: true });

    const client1 = await connectClient();
    const p1WaitingPromise = onceEvent<RoomSnapshot>(client1, 'room:state');
    const createAck = await emitAck<RoomAck>(client1, 'room:create', {
      playerName: 'Ana',
      targetScore: 15,
    });
    const p1Waiting = await p1WaitingPromise;

    expect(createAck).toMatchObject({ ok: true, snapshot: p1Waiting });
    expect(p1Waiting.status).toBe('waiting');
    expect(p1Waiting.code).toMatch(ROOM_CODE_REGEX);
    expect(p1Waiting.gameView).toBeNull();

    const client2 = await connectClient();
    const p1PlayingPromise = onceEvent<RoomSnapshot>(client1, 'room:state');
    const p2PlayingPromise = onceEvent<RoomSnapshot>(client2, 'room:state');
    const joinAck = await emitAck<RoomAck>(client2, 'room:join', {
      code: p1Waiting.code.toLowerCase(),
      playerName: 'Beto',
    });
    const [p1Playing, p2Playing] = await Promise.all([p1PlayingPromise, p2PlayingPromise]);

    expect(joinAck).toMatchObject({ ok: true, snapshot: p2Playing });
    expect(p1Playing.status).toBe('playing');
    expect(p2Playing.status).toBe('playing');
    expect(p1Playing.gameView).not.toBeNull();
    expect(p2Playing.gameView).not.toBeNull();

    const p1View = p1Playing.gameView!;
    const p2View = p2Playing.gameView!;
    expect('deck' in p1View).toBe(false);
    expect('deck' in p2View).toBe(false);

    const p1Self = p1View.players.find((p) => p.id === p1Playing.selfPlayerId)!;
    const p1Rival = p1View.players.find((p) => p.id === p2Playing.selfPlayerId)!;
    expect(p1Self.hand).toHaveLength(3);
    expect(p1Rival.hand).toBeUndefined();
    expect('hand' in p1Rival).toBe(false);
    expect(p1Rival.handCount).toBe(3);

    const p2Self = p2View.players.find((p) => p.id === p2Playing.selfPlayerId)!;
    const p2Rival = p2View.players.find((p) => p.id === p1Playing.selfPlayerId)!;
    expect(p2Self.hand).toHaveLength(3);
    expect(p2Rival.hand).toBeUndefined();
    expect('hand' in p2Rival).toBe(false);
    expect(p2Rival.handCount).toBe(3);

    const client3 = await connectClient();
    const missingErrorPromise = onceEvent<{ message: string }>(client3, 'room:error');
    const missingAck = await emitAck<RoomAck>(client3, 'room:join', {
      code: 'ZZZZZ',
      playerName: 'Carla',
    });
    const missingError = await missingErrorPromise;

    expect(missingError.message).toBeTruthy();
    expect(missingAck).toEqual({ ok: false, error: missingError.message });

    const fullErrorPromise = onceEvent<{ message: string }>(client3, 'room:error');
    const fullAck = await emitAck<RoomAck>(client3, 'room:join', {
      code: p1Waiting.code,
      playerName: 'Carla',
    });
    const fullError = await fullErrorPromise;

    expect(fullError.message).toBeTruthy();
    expect(fullAck).toEqual({ ok: false, error: fullError.message });
  });

  it(
    'sincroniza jugadas por game:play, autoriza por socket, maneja disconnect/reconnect, nextRound y rematch (H6 micro-test #2)',
    async () => {
      const client1 = await connectClient();
      const p1WaitingPromise = onceEvent<RoomSnapshot>(client1, 'room:state');
      const createAck = await emitAck<RoomAck>(client1, 'room:create', {
        playerName: 'Ana',
        targetScore: 15,
      });
      const p1Waiting = await p1WaitingPromise;
      expect(createAck.ok).toBe(true);
      const roomCode = p1Waiting.code;
      const p1Id = p1Waiting.selfPlayerId;

      const client2 = await connectClient();
      const p1StartPromise = onceEvent<RoomSnapshot>(client1, 'room:state');
      const p2StartPromise = onceEvent<RoomSnapshot>(client2, 'room:state');
      const joinAck = await emitAck<RoomAck>(client2, 'room:join', {
        code: roomCode,
        playerName: 'Beto',
      });
      let [snap1, snap2] = await Promise.all([p1StartPromise, p2StartPromise]);

      expect(joinAck.ok).toBe(true);
      const p2Id = snap2.selfPlayerId;
      const p2Token = snap2.sessionToken!;
      expect(p2Token).toBeTruthy();
      expect(snap1.gameView?.currentPlayerIndex).toBe(0);

      const p1FirstAction = pickLegalAction(snap1.gameView!);
      let unexpectedStates = 0;
      const onUnexpectedState = () => {
        unexpectedStates += 1;
      };
      client1.on('room:state', onUnexpectedState);

      const client3 = await connectClient();
      const [outsiderError, outsiderAck] = await Promise.all([
        onceEvent<{ message: string }>(client3, 'room:error'),
        emitAck<RoomAck>(client3, 'game:play', {
          playerId: p1Id,
          action: p1FirstAction,
        }),
      ]);
      expect(outsiderError.message).toBeTruthy();
      expect(outsiderAck).toEqual({ ok: false, error: outsiderError.message });

      const [outOfTurnError, outOfTurnAck] = await Promise.all([
        onceEvent<{ message: string }>(client2, 'room:error'),
        emitAck<RoomAck>(client2, 'game:play', {
          playerId: p1Id,
          action: p1FirstAction,
        }),
      ]);
      expect(outOfTurnError.message).toBeTruthy();
      expect(outOfTurnAck).toEqual({ ok: false, error: outOfTurnError.message });

      client1.off('room:state', onUnexpectedState);
      expect(unexpectedStates).toBe(0);

      const emitAndSync = async (
        emitter: Socket,
        event: string,
        payload: unknown,
        secondClient: Socket
      ): Promise<[RoomAck, RoomSnapshot, RoomSnapshot]> =>
        Promise.all([
          emitAck<RoomAck>(emitter, event, payload),
          onceEvent<RoomSnapshot>(client1, 'room:state'),
          onceEvent<RoomSnapshot>(secondClient, 'room:state'),
        ]);

      let play1Ack: RoomAck;
      [play1Ack, snap1, snap2] = await emitAndSync(
        client1,
        'game:play',
        { action: p1FirstAction },
        client2
      );

      expect(play1Ack).toMatchObject({ ok: true, snapshot: snap1 });
      expect(snap1.gameView?.currentPlayerIndex).toBe(1);
      expect(snap1.gameView?.lastAction?.playerId).toBe(p1Id);
      expect(snap1.gameView?.players.find((p) => p.id === p1Id)?.handCount).toBe(2);
      expect(snap2.gameView?.players.find((p) => p.id === p1Id)?.handCount).toBe(2);
      assertHandPrivacy(snap1, p1Id, p2Id);
      assertHandPrivacy(snap2, p2Id, p1Id);

      const p1DisconnectPromise = onceEvent<RoomSnapshot>(client1, 'room:state');
      client2.disconnect();
      snap1 = await p1DisconnectPromise;

      expect(snap1.players.find((p) => p.id === p2Id)?.connected).toBe(false);
      expect(snap1.gameView?.players.find((p) => p.id === p2Id)?.connected).toBe(false);

      const client2Reconnected = await connectClient();
      let reconnectAck: RoomAck;
      [reconnectAck, snap1, snap2] = await emitAndSync(
        client2Reconnected,
        'room:reconnect',
        { code: roomCode, sessionToken: p2Token },
        client2Reconnected
      );

      expect(reconnectAck).toMatchObject({ ok: true, snapshot: snap2 });
      expect(snap2.sessionToken).toBe(p2Token);
      expect(snap2.selfPlayerId).toBe(p2Id);
      expect(snap2.players.find((p) => p.id === p2Id)?.connected).toBe(true);
      expect(snap1.players.find((p) => p.id === p2Id)?.connected).toBe(true);
      expect(snap1.gameView?.players.find((p) => p.id === p2Id)?.connected).toBe(true);
      assertHandPrivacy(snap1, p1Id, p2Id);
      assertHandPrivacy(snap2, p2Id, p1Id);

      const playRound = async () => {
        for (let step = 0; step < 50 && snap1.gameView?.phase === 'playing'; step += 1) {
          const currentPlayerId = snap1.gameView.players[snap1.gameView.currentPlayerIndex].id;
          const isP1Turn = currentPlayerId === p1Id;
          const activeSocket = isP1Turn ? client1 : client2Reconnected;
          const activeSnap = isP1Turn ? snap1 : snap2;
          const action = pickLegalAction(activeSnap.gameView!);

          let moveAck: RoomAck;
          [moveAck, snap1, snap2] = await emitAndSync(
            activeSocket,
            'game:play',
            { action },
            client2Reconnected
          );
          expect(moveAck.ok).toBe(true);
        }
      };

      await playRound();
      expect(snap1.gameView?.phase).toBe('round_end');
      expect(snap2.gameView?.phase).toBe('round_end');

      let nextRoundAck: RoomAck;
      [nextRoundAck, snap1, snap2] = await emitAndSync(
        client1,
        'game:nextRound',
        {},
        client2Reconnected
      );

      expect(nextRoundAck.ok).toBe(true);
      expect(snap1.gameView?.phase).toBe('playing');
      expect(snap1.gameView?.round).toBe(2);
      expect(snap2.gameView?.phase).toBe('playing');
      expect(snap2.gameView?.round).toBe(2);

      await playRound();
      for (let guard = 0; guard < 25 && snap1.gameView?.phase === 'round_end'; guard += 1) {
        let ack: RoomAck;
        [ack, snap1, snap2] = await emitAndSync(
          client1,
          'game:nextRound',
          {},
          client2Reconnected
        );
        expect(ack.ok).toBe(true);
        await playRound();
      }

      expect(snap1.gameView?.phase).toBe('game_over');
      expect(snap2.gameView?.phase).toBe('game_over');

      let rematchAck: RoomAck;
      [rematchAck, snap1, snap2] = await emitAndSync(
        client2Reconnected,
        'game:rematch',
        {},
        client2Reconnected
      );

      expect(rematchAck.ok).toBe(true);
      expect(snap1.code).toBe(roomCode);
      expect(snap2.code).toBe(roomCode);
      expect(snap1.status).toBe('playing');
      expect(snap2.status).toBe('playing');
      expect(snap1.gameView?.phase).toBe('playing');
      expect(snap2.gameView?.phase).toBe('playing');
      expect(snap1.gameView?.round).toBe(1);
      expect(snap2.gameView?.round).toBe(1);
      expect(snap1.gameView?.players.every((p) => p.score === 0 && p.handCount === 3)).toBe(true);
      expect(snap2.gameView?.players.every((p) => p.score === 0 && p.handCount === 3)).toBe(true);
      assertHandPrivacy(snap1, p1Id, p2Id);
      assertHandPrivacy(snap2, p2Id, p1Id);
    },
    15000
  );
});
