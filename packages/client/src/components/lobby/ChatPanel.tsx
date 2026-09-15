import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ClientEvents,
  DmHistoryPayload,
  DmMessagePayload,
  FriendEntry,
  FriendListPayload,
  ServerEvents,
} from '@werewolf/shared';
import { socket } from '../../lib/socket';
import { getDeviceId } from '../../lib/deviceId';

interface ChatPanelProps {
  onClose: () => void;
  unreadFrom: Set<string>;
  onMarkRead: (deviceId: string) => void;
}

const ADMIN_ID = '0000000000';
const ADMIN_GREETING = 'Chào mừng bạn đến với Ma Sói Online! Chúc bạn có những ván đấu thật vui 🐺';
const EMOJIS = ['😀', '😂', '😍', '😎', '😭', '👍', '❤️', '🔥', '🎉', '🐺', '🌕', '🗡️'];

export function ChatPanel({ onClose, unreadFrom, onMarkRead }: ChatPanelProps) {
  const myId = useMemo(() => getDeviceId(), []);
  const [thread, setThread] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [dmMessages, setDmMessages] = useState<Record<string, DmMessagePayload[]>>({});
  const [draft, setDraft] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFriendList = (payload: FriendListPayload) => setFriends(payload.friends);
    const onDmHistory = (payload: DmHistoryPayload) => setDmMessages((prev) => ({ ...prev, [payload.withDeviceId]: payload.messages }));
    const onDmMessage = (msg: DmMessagePayload) => {
      const otherId = msg.fromDeviceId === myId ? msg.toDeviceId : msg.fromDeviceId;
      setDmMessages((prev) => ({ ...prev, [otherId]: [...(prev[otherId] ?? []), msg] }));
    };
    socket.on(ServerEvents.FRIEND_LIST, onFriendList);
    socket.on(ServerEvents.DM_HISTORY, onDmHistory);
    socket.on(ServerEvents.DM_MESSAGE, onDmMessage);
    socket.emit(ClientEvents.FRIEND_LIST_REQUEST);
    return () => {
      socket.off(ServerEvents.FRIEND_LIST, onFriendList);
      socket.off(ServerEvents.DM_HISTORY, onDmHistory);
      socket.off(ServerEvents.DM_MESSAGE, onDmMessage);
    };
  }, [myId]);

  useEffect(() => {
    if (thread && thread !== ADMIN_ID) {
      socket.emit(ClientEvents.DM_HISTORY_REQUEST, { withDeviceId: thread });
      onMarkRead(thread);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [dmMessages, thread]);

  const visibleFriends = useMemo(
    () => friends.filter((f) => f.nickname.toLowerCase().includes(search.trim().toLowerCase())),
    [friends, search],
  );

  function selectThread(id: string) {
    setThread(id);
    setShowEmoji(false);
    if (unreadFrom.has(id)) onMarkRead(id);
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text || !thread || thread === ADMIN_ID) return;
    socket.emit(ClientEvents.DM_SEND, { toDeviceId: thread, text });
    setDraft('');
  }

  function handleSend(e: FormEvent) {
    e.preventDefault();
    sendMessage();
  }

  const activeMessages = thread === ADMIN_ID ? [] : dmMessages[thread ?? ''] ?? [];

  return (
    <div
      className="fixed inset-0 z-50 bg-cover bg-center flex items-center justify-center px-4"
      style={{ backgroundImage: 'url(/ui/chat/background.png)' }}
    >
      <div className="relative w-full max-w-4xl" style={{ aspectRatio: '1535 / 1024' }}>
        <img src="/ui/chat/frame.png" alt="" className="w-full h-full select-none pointer-events-none" draggable={false} />

        <button type="button" onClick={onClose} className="absolute right-[2.5%] top-[1.5%] w-[5%] aspect-square" aria-label="Đóng" />

        {/* Sidebar: search + threads */}
        <div className="absolute left-[1.5%] right-[73%] top-[15%] bottom-[2%] flex flex-col gap-2 px-1 overflow-y-auto no-scrollbar">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm bạn..."
            className="w-full rounded-full bg-night-950/60 border border-moon-400/30 px-3 py-1.5 text-xs text-parchment-100 outline-none placeholder:text-mist-500 flex-shrink-0"
          />

          {'admin'.includes(search.trim().toLowerCase()) && (
            <ThreadRow
              label="Admin"
              sub="ID: 0000000000"
              active={thread === ADMIN_ID}
              onClick={() => selectThread(ADMIN_ID)}
              avatarUrl="/ui/chat/admin_avatar.png"
              initial="A"
            />
          )}

          {visibleFriends.map((f) => (
            <ThreadRow
              key={f.deviceId}
              label={f.nickname}
              online={f.online}
              avatarUrl={f.avatarUrl}
              active={thread === f.deviceId}
              unread={unreadFrom.has(f.deviceId)}
              onClick={() => selectThread(f.deviceId)}
              initial={f.nickname.charAt(0).toUpperCase()}
            />
          ))}
        </div>

        {!thread ? (
          <div className="absolute left-[30%] right-[8.5%] top-[16%] bottom-[16%] flex items-center justify-center text-mist-400 text-sm">
            Chọn một người để bắt đầu trò chuyện
          </div>
        ) : thread === ADMIN_ID ? (
          <div className="absolute left-[30%] right-[8.5%] top-[16%] bottom-[16%] overflow-y-auto no-scrollbar px-4 py-2">
            <Bubble text={ADMIN_GREETING} nickname="Admin" avatarUrl="/ui/chat/admin_avatar.png" mine={false} />
          </div>
        ) : (
          <div ref={listRef} className="absolute left-[30%] right-[8.5%] top-[16%] bottom-[16%] overflow-y-auto no-scrollbar px-4 py-2 space-y-2">
            {activeMessages.map((m, i) => (
              <Bubble key={i} text={m.text} nickname={m.fromNickname} avatarUrl={m.fromAvatarUrl} mine={m.fromDeviceId === myId} />
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="absolute left-[31%] right-[9%] top-[87%] h-[8%] flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={300}
            disabled={!thread || thread === ADMIN_ID}
            placeholder={!thread ? 'Chọn người để nhắn' : thread === ADMIN_ID ? 'Chưa thể nhắn cho Admin' : 'Nhập tin nhắn...'}
            className="flex-1 h-full bg-transparent px-4 text-parchment-100 outline-none placeholder:text-mist-500 disabled:opacity-50"
          />
        </form>

        {/* Emoji trigger — sits over the smiley glyph baked into the frame art */}
        <button
          type="button"
          onClick={() => setShowEmoji((v) => !v)}
          disabled={!thread || thread === ADMIN_ID}
          className="absolute right-[12%] top-[85%] h-[9%] w-[7%] disabled:opacity-40"
          aria-label="Chọn emoji"
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={!thread || thread === ADMIN_ID}
          className="absolute right-[1.5%] top-[85%] h-[9%] w-[7%] disabled:opacity-40"
          aria-label="Gửi"
        />

        {showEmoji && (
          <div className="absolute right-[9%] bottom-[15%] bg-night-900 border border-moon-400/40 rounded-xl p-2 grid grid-cols-6 gap-1 z-10">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setDraft((d) => d + e);
                  setShowEmoji(false);
                }}
                className="text-lg hover:scale-125 transition-transform"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({ text, nickname, avatarUrl, mine }: { text: string; nickname: string; avatarUrl: string | null; mine: boolean }) {
  return (
    <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
      <span className="w-8 h-8 rounded-full bg-night-800 flex-shrink-0 overflow-hidden">
        {avatarUrl && <img src={avatarUrl} alt="" className="w-full h-full object-cover" />}
      </span>
      <div className={`max-w-[75%] ${mine ? 'text-right' : ''}`}>
        {!mine && <p className="text-moon-400 text-[10px] mb-0.5">{nickname}</p>}
        <p
          className={`inline-block rounded-2xl px-3 py-1.5 text-sm backdrop-blur-sm text-parchment-100 ${
            mine ? 'bg-black/40' : 'bg-white/15'
          }`}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

function ThreadRow({
  label,
  sub,
  online,
  unread,
  avatarUrl,
  active,
  onClick,
  initial,
}: {
  label: string;
  sub?: string;
  online?: boolean;
  unread?: boolean;
  avatarUrl?: string | null;
  active: boolean;
  onClick: () => void;
  initial: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-2 rounded-lg border px-2 py-2 text-left flex-shrink-0 ${
        active ? 'border-moon-400 bg-night-900/80' : 'border-moon-400/30 bg-night-900/50 hover:bg-night-900/80'
      }`}
    >
      <span className="relative w-9 h-9 rounded-full bg-moon-400/80 flex-shrink-0 flex items-center justify-center text-night-950 text-xs font-bold overflow-hidden">
        {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : initial}
        {online !== undefined && (
          <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-night-950 ${online ? 'bg-green-400' : 'bg-mist-600'}`} />
        )}
      </span>
      <div className="min-w-0">
        <p className="text-parchment-100 text-xs font-semibold truncate">{label}</p>
        {sub && <p className="text-mist-500 text-[10px] font-mono">{sub}</p>}
      </div>
      {unread && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-orange-500 border border-night-950" />}
    </button>
  );
}
