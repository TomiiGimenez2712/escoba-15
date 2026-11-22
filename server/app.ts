import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { RoomManager } from './roomManager';
import { registerSocketHandlers } from './socketHandlers';

export interface ServerAppInstance {
  app: express.Express;
  httpServer: http.Server;
  io: Server;
  roomManager: RoomManager;
}

/** Construye la aplicación Express, el servidor HTTP y Socket.IO con los handlers de sala. */
export function createServerApp(): ServerAppInstance {
  const app = express();

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  const distDir = path.resolve(process.cwd(), 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    app.use(express.static(distDir));
    app.use((req, res, next) => {
      if (
        req.method !== 'GET' ||
        req.path.startsWith('/api') ||
        req.path.startsWith('/socket.io')
      ) {
        next();
        return;
      }
      res.sendFile(indexHtmlPath);
    });
  }

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
    },
  });
  const roomManager = new RoomManager();
  registerSocketHandlers(io, roomManager);

  return { app, httpServer, io, roomManager };
}
