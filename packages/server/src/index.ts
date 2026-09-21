import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { createSocketServer } from './sockets';
import { registerAuthRoutes } from './auth/googleAuth';

const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
registerAuthRoutes(app);

const httpServer = createServer(app);
createSocketServer(httpServer);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Ma Sói server đang chạy tại cổng ${PORT}`);
});
