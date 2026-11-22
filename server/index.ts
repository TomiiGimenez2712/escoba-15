import { createServerApp } from './app';

const ROOM_TTL_MS = 10 * 60_000;
const ROOM_CLEANUP_INTERVAL_MS = 60_000;

const port = Number(process.env.PORT) || 3001;
const { httpServer, roomManager } = createServerApp();

setInterval(() => {
  roomManager.cleanupExpiredRooms(ROOM_TTL_MS);
}, ROOM_CLEANUP_INTERVAL_MS).unref();

httpServer.listen(port, () => {
  console.log(`Servidor Escoba 15 escuchando en http://localhost:${port}`);
});
