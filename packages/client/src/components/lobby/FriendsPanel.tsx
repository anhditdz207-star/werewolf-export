import { FormEvent, useEffect, useState } from 'react';
import { ClientEvents, FriendEntry, FriendListPayload, ServerEvents, SocialErrorPayload } from '@werewolf/shared';
import { socket } from '../../lib/socket';

interface FriendsPanelProps {
  onClose: () => void;
}

export function FriendsPanel({ onClose }: FriendsPanelProps) {
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [pending, setPending] = useState<FriendEntry[]>([]);
  const [myId, setMyId] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onList = (payload: FriendListPayload) => {
      setFriends(payload.friends);
      setPending(payload.pendingRequests);
      setMyId(payload.myFriendCode);
    };
    const onError = (payload: SocialErrorPayload) => setError(payload.message);
    socket.on(ServerEvents.FRIEND_LIST, onList);
    socket.on(ServerEvents.SOCIAL_ERROR, onError);
    socket.emit(ClientEvents.FRIEND_LIST_REQUEST);
    return () => {
      socket.off(ServerEvents.FRIEND_LIST, onList);
      socket.off(ServerEvents.SOCIAL_ERROR, onError);
    };
  }, []);

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    const code = codeInput.trim();
    if (!code) return;
    setError(null);
    socket.emit(ClientEvents.FRIEND_ADD, { friendCode: code });
    setCodeInput('');
    setShowAddForm(false);
  }

  function respond(deviceId: string, accept: boolean) {
    socket.emit(accept ? ClientEvents.FRIEND_ACCEPT : ClientEvents.FRIEND_DECLINE, { deviceId });
  }

  function copyMyCode() {
    if (myId) navigator.clipboard?.writeText(myId).catch(() => {});
  }

  return (
    <div className="fixed inset-0 z-50 bg-night-950/85 flex items-center justify-center px-4">
      <div className="relative w-full max-w-3xl" style={{ aspectRatio: '1548 / 1016' }}>
        <img src="/ui/friends/khung.png" alt="" className="w-full h-full select-none pointer-events-none" draggable={false} />

        <button type="button" onClick={onClose} className="absolute right-[2%] top-[1.5%] w-[6.5%] aspect-square" aria-label="Đóng" />
        <button
          type="button"
          onClick={() => setShowRequests((v) => !v)}
          title="Lời mời kết bạn"
          className="absolute right-[10.5%] top-[1.5%] w-[6.5%] aspect-square"
          aria-label="Hộp thư lời mời"
        />
        {pending.length > 0 && (
          <span className="absolute right-[11%] top-[2%] w-3.5 h-3.5 rounded-full bg-blood-500 border border-night-950 pointer-events-none" />
        )}
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          title="Thêm bạn bè bằng ID"
          className="absolute right-[19%] top-[1.5%] w-[6.5%] aspect-square"
          aria-label="Thêm bạn bè"
        />

        <div className="absolute inset-x-[2%] top-[16%] bottom-[4%] overflow-y-auto px-[3%]">
          {showAddForm && (
            <form onSubmit={handleAdd} className="flex gap-2 mb-4">
              <input
                autoFocus
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Nhập ID bạn bè (10 số)..."
                className="flex-1 rounded-full bg-night-950 border border-moon-400/40 px-4 py-2 text-parchment-100 text-sm outline-none focus:ring-1 focus:ring-moon-400"
              />
              <button type="submit" className="rounded-full bg-moon-400 px-4 py-2 text-sm font-semibold text-night-950 hover:bg-moon-300">
                Gửi lời mời
              </button>
            </form>
          )}

          {error && <p className="text-blood-500 text-sm mb-3">{error}</p>}

          {showRequests && (
            <div className="mb-4 space-y-2">
              <p className="text-moon-400 text-xs font-semibold uppercase tracking-wide">Lời mời kết bạn</p>
              {pending.length === 0 ? (
                <p className="text-mist-400 text-sm">Không có lời mời nào.</p>
              ) : (
                pending.map((p) => (
                  <div key={p.deviceId} className="flex items-center gap-3 bg-night-900/50 rounded-lg px-3 py-2">
                    <span className="w-8 h-8 rounded-full overflow-hidden bg-night-800 flex-shrink-0">
                      {p.avatarUrl && <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />}
                    </span>
                    <span className="text-parchment-100">{p.nickname}</span>
                    <div className="ml-auto flex gap-2">
                      <button type="button" onClick={() => respond(p.deviceId, true)} className="rounded-full bg-moon-400 px-3 py-1 text-xs font-semibold text-night-950 hover:bg-moon-300">
                        Chấp nhận
                      </button>
                      <button type="button" onClick={() => respond(p.deviceId, false)} className="rounded-full border border-mist-600 px-3 py-1 text-xs text-mist-400 hover:bg-night-800">
                        Từ chối
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {friends.length === 0 ? (
            <p className="text-mist-400">Chưa có bạn bè nào. Chia sẻ ID của bạn để kết bạn.</p>
          ) : (
            <div className="space-y-2">
              {friends.map((f) => (
                <div key={f.deviceId} className="flex items-center gap-3 bg-night-900/50 rounded-lg px-3 py-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${f.online ? 'bg-green-400' : 'bg-mist-600'}`} />
                  <span className="w-8 h-8 rounded-full overflow-hidden bg-night-800 flex-shrink-0">
                    {f.avatarUrl && <img src={f.avatarUrl} alt="" className="w-full h-full object-cover" />}
                  </span>
                  <span className="text-parchment-100">{f.nickname}</span>
                  <span className="text-mist-500 text-xs ml-auto">{f.online ? 'Online' : 'Offline'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
