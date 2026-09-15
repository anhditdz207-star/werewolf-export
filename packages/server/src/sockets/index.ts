import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { RoomManager } from '../rooms/RoomManager';
import { GameSessionRegistry } from './GameSessionRegistry';
import { SocketAuthRegistry } from './SocketAuth';
import { registerLobbyHandlers } from './handlers/lobbyHandlers';
import { registerNightActionHandlers } from './handlers/nightActionHandlers';
import { registerVotingHandlers } from './handlers/votingHandlers';
import { registerChatHandlers } from './handlers/chatHandlers';
import { registerSocialHandlers } from './handlers/socialHandlers';
import { registerVoiceHandlers } from './handlers/voiceHandlers';
import { SocialManager } from '../social/SocialManager';

/**
 * Creates and configures the Socket.IO server. All game state
 * (RoomManager, GameSessionRegistry, SocketAuthRegistry) lives here, in
 * closure scope — a single process holds everything in memory. See
 * RoomManager's docstring for the note on swapping to Redis if this
 * ever needs to run across multiple server instances.
 */
export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      // TODO: replace with your actual frontend origin(s) before deploying.
      origin: process.env.CLIENT_ORIGIN ?? '*',
    },
  });

  const roomManager = new RoomManager();
  const sessionRegistry = new GameSessionRegistry();
  const auth = new SocketAuthRegistry();
  const social = new SocialManager();

  io.on('connection', (socket: Socket) => {
    registerLobbyHandlers(io, socket, roomManager, sessionRegistry, auth);
    registerNightActionHandlers(io, socket, roomManager, sessionRegistry, auth);
    registerVotingHandlers(io, socket, roomManager, sessionRegistry, auth);
    registerChatHandlers(io, socket, roomManager, sessionRegistry, auth);
    registerSocialHandlers(io, socket, social);
    registerVoiceHandlers(io, socket, roomManager, auth);
  });

  return io;
}
