# Ma Sói Online 🐺🌙

Game Ma Sói (Werewolf/Mafia) chơi qua web, real-time, theo phòng — xây bằng
React + TypeScript (client) và Node.js + Express + Socket.IO (server),
dùng kiến trúc finite state machine cho luồng chơi.

## Cấu trúc monorepo

```
packages/
  shared/   Types & Socket.IO event contract dùng chung client-server
  server/   Node.js + Express + Socket.IO backend (game logic, FSM)
  client/   React + Tailwind CSS frontend
```

## Cài đặt & chạy thử

Yêu cầu: Node.js 18+, npm 9+.

```bash
git clone <repo-url>
cd werewolf-online
npm install
```

Chạy backend (mặc định cổng 4000):
```bash
npm run dev --workspace=@werewolf/server
```

Chạy frontend (mặc định cổng 5173), ở terminal khác:
```bash
npm run dev --workspace=@werewolf/client
```

Mở `http://localhost:5173`, tạo phòng, mở thêm vài tab/thiết bị khác để
vào cùng phòng bằng mã phòng hiển thị trên màn hình.

Nếu muốn trỏ frontend tới một backend khác (không phải localhost:4000),
tạo file `packages/client/.env`:
```
VITE_SERVER_URL=https://your-server-domain.com
```

## Vai trò đã hỗ trợ (Phase 1)

Ma Sói, Dân thường, Tiên tri, Bảo vệ, Phù thủy (thuốc cứu + thuốc độc),
Thợ săn, Cupid. Chi tiết luật ở docstring trong
`packages/server/src/game/engine/NightResolver.ts`.

## Các giả định luật đã chốt trong quá trình phát triển

- Vote hòa ở vòng đầu → bầu lại giữa những người bị hòa → nếu vẫn hòa,
  không ai bị treo cổ hôm đó.
- Cupid ghép đôi khác phe: chỉ liên kết cái chết (chưa có "phe thứ ba"
  thắng riêng) — có thể mở rộng sau trong `WinConditionChecker.ts`.
- Phù thủy: được tự cứu mình nếu bản thân là nạn nhân của Sói đêm đó;
  mỗi đêm chỉ được dùng MỘT trong hai bình thuốc.
- Vai trò được công khai cho mọi người **ngay khi người chơi đó chết**
  (bị Sói cắn / treo cổ / bắn); vai trò người còn sống chỉ chính họ
  thấy được cho đến khi kết thúc ván.

## Việc còn để mở rộng (Phase 2+)

- Cơ chế rejoin sau khi tải lại trang (đã có sẵn `Room.setSocketId`,
  chỉ thiếu event `room:rejoin` phía client — xem ghi chú trong
  `SocketAuth.ts`).
- Voice chat (WebRTC), MC ảo đọc luật bằng giọng nói.
- Thêm vai trò: Sói trắng, Già làng, Đội trưởng...
- Scale nhiều tiến trình server: xem ghi chú trong `RoomManager.ts` về
  việc thay `Map` trong bộ nhớ bằng Redis.

## Deploy

- **Backend**: cần một nền tảng giữ WebSocket sống liên tục — Render,
  Railway, Fly.io. KHÔNG dùng serverless functions thông thường (Vercel
  Functions) vì chúng không giữ kết nối lâu.
- **Frontend**: Vercel/Netlify đều chạy tốt (build tĩnh qua Vite).
- Nhớ đổi CORS `origin` trong `packages/server/src/sockets/index.ts`
  từ `'*'` sang domain frontend thật trước khi deploy production.
