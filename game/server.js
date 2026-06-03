import 'dotenv/config';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { createApp } from './lib/create-app.js';
import { attachRooms } from './lib/rooms.js';

const { PORT = 3000 } = process.env;
const { app, getHostLine, hasKey } = createApp();

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
attachRooms(wss, { getHostLine });

server.listen(PORT, () => {
  console.log(`\n  🍻  GO FUCK YOURSELF running at http://localhost:${PORT}`);
  console.log(`      Multiplayer: two phones, one room code. WebSocket on /ws.`);
  console.log(`      AI host: ${hasKey ? 'ENABLED' : 'OFFLINE fallback (no NVIDIA_API_KEY)'}\n`);
});
