// @vitest-environment node
import type { AddressInfo } from 'node:net';
import { io as createClient, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { RoomSnapshot } from '../shared/types';
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

  function onceEvent<T>(socket: Socket, event: string): Promise<T> {
    return new Promise<T>((resolve) => {
      socket.once(event, (payload: T) => resolve(payload));
    });
  }

  function emitAck<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
    return new Promise<T>((resolve) => {
      socket.emit(event, payload, (response: T) => resolve(response));
    });
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
});
