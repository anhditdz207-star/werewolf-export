import { io, Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';

/**
 * Single shared socket instance for the whole app. Connection is
 * established once (on first import) and reused across page
 * navigation — there's no login, so the socket IS the session.
 */
export const socket: Socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ['websocket'],
});
