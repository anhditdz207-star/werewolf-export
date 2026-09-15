import { useEffect, useRef, useState } from 'react';
import { DmMessagePayload, ServerEvents } from '@werewolf/shared';
import { socket } from '../lib/socket';
import { getDeviceId } from '../lib/deviceId';
import { audioManager } from '../lib/audio';
import { fileToAvatarDataUrl } from '../lib/avatar';
import { PRESET_AVATARS } from '../data/presetAvatars';
import { SettingsPanel } from '../components/lobby/SettingsPanel';
import { ChatPanel } from '../components/lobby/ChatPanel';
import { FriendsPanel } from '../components/lobby/FriendsPanel';

interface LobbyPageProps {
  nickname: string;
  myId: string | null;
  friendRequestCount: number;
  avatarUrl: string | null;
  onRenameNickname: (nickname: string) => void;
  onAvatarChange: (dataUrl: string) => void;
  onOpenCreateRoom: () => void;
  onOpenJoinRoom: () => void;
  onLogout: () => void;
  onOpenCardGallery: () => void;
}

export function LobbyPage({
  nickname,
  myId,
  friendRequestCount,
  avatarUrl,
  onRenameNickname,
  onAvatarChange,
  onOpenCreateRoom,
  onOpenJoinRoom,
  onLogout,
  onOpenCardGallery,
}: LobbyPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [nameDraft, setNameDraft] = useState(nickname);
  const [showFriends, setShowFriends] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [unreadFrom, setUnreadFrom] = useState<Set<string>>(new Set());

  useEffect(() => {
    const myId = getDeviceId();
    const onDm = (msg: DmMessagePayload) => {
      if (msg.fromDeviceId === myId) return;
      setUnreadFrom((prev) => new Set(prev).add(msg.fromDeviceId));
    };
    socket.on(ServerEvents.DM_MESSAGE, onDm);
    return () => {
      socket.off(ServerEvents.DM_MESSAGE, onDm);
    };
  }, []);

  function markThreadRead(deviceId: string) {
    setUnreadFrom((prev) => {
      if (!prev.has(deviceId)) return prev;
      const next = new Set(prev);
      next.delete(deviceId);
      return next;
    });
  }
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    audioManager.playBgm('lobby');
  }, []);

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      onAvatarChange(dataUrl);
      setShowAvatarPicker(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải ảnh lên.');
    }
  }

  function handleRename() {
    setNameDraft(nickname);
    setShowRename(true);
  }

  function saveRename() {
    const trimmed = nameDraft.trim();
    if (trimmed) onRenameNickname(trimmed);
    setShowRename(false);
  }

  return (
    <div
      className="h-screen w-screen overflow-hidden bg-cover bg-center relative"
      style={{ backgroundImage: 'url(/ui/lobby/background_lobby.png)' }}
    >
      {/* Player profile — top left (1.5x size) */}
      <div className="fixed top-4 left-4 w-[336px] sm:w-[384px] z-20">
        <img src="/ui/lobby/player_profile_frame.png" alt="" className="w-full select-none pointer-events-none" draggable={false} />
        <button
          type="button"
          onClick={() => setShowAvatarPicker(true)}
          title="Đổi ảnh đại diện"
          className="absolute left-[3.6%] top-[10.5%] w-[26%] aspect-square rounded-full overflow-hidden"
        >
          {avatarUrl && <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />}
        </button>
        <span className="absolute inset-0 flex flex-col justify-center pl-[33%] pr-[8%]">
          <span className="text-parchment-100 font-semibold text-lg truncate">{nickname}</span>
          {myId && <span className="text-moon-400/80 text-xs font-mono">ID: {myId}</span>}
        </span>
      </div>

      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />

      {/* Header button frame — top right (book · settings · friends · chat) */}
      <div
        className="fixed top-0 right-[-38px] z-20 flex items-start gap-2 sm:gap-3 pl-[99px] sm:pl-[131px] pr-12 sm:pr-16 py-3 sm:py-4"
        style={{
          backgroundImage: 'url(/ui/lobby/frame_containing_buttons.png)',
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {[
          { src: '/ui/lobby/chat_button.png', label: 'Trò chuyện', onClick: () => setShowChat(true), size: 'w-9 sm:w-11', className: '' },
          { src: '/ui/lobby/friends_button.png', label: 'Bạn bè', onClick: () => setShowFriends(true), size: 'w-9 sm:w-11', className: '' },
          { src: '/ui/lobby/list_button.png', label: 'Lá bài', onClick: onOpenCardGallery, size: 'w-12 sm:w-16', className: 'ml-[27px]' },
          { src: '/ui/lobby/three_line_button.png', label: 'Cài đặt', onClick: () => setShowSettings(true), size: 'w-12 sm:w-16', className: '' },
        ].map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={btn.onClick}
            title={btn.label}
            className={`relative ${btn.size} ${btn.className} aspect-square transition-transform hover:scale-105 active:scale-95 flex-shrink-0`}
          >
            <img src={btn.src} alt={btn.label} className="w-full h-full select-none pointer-events-none" draggable={false} />
            {btn.label === 'Bạn bè' && friendRequestCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blood-500 border border-night-950" />
            )}
            {btn.label === 'Trò chuyện' && unreadFrom.size > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blood-500 border border-night-950" />
            )}
          </button>
        ))}
      </div>

      {/* Main content: create + join panels */}
      <div className="h-full flex flex-col sm:flex-row items-center justify-center gap-8">
        <button
          type="button"
          onClick={onOpenCreateRoom}
          className="relative w-[300px] h-[448px] transition-transform hover:scale-[1.03] active:scale-95"
        >
          <img
            src="/ui/lobby/room_creation_box.png"
            alt="Tạo phòng"
            className="w-full h-full object-cover select-none pointer-events-none drop-shadow-2xl"
            draggable={false}
          />
        </button>

        <button
          type="button"
          onClick={onOpenJoinRoom}
          className="relative w-[300px] h-[448px] transition-transform hover:scale-[1.03] active:scale-95"
        >
          <img
            src="/ui/lobby/enter_room_box.png"
            alt="Vào phòng"
            className="w-full h-full object-cover select-none pointer-events-none drop-shadow-2xl"
            draggable={false}
          />
        </button>
      </div>

      {error && (
        <p className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-night-950/90 border border-blood-500/60 px-4 py-2 text-sm text-blood-500">
          {error}
        </p>
      )}

      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onChangeAvatar={() => setShowAvatarPicker(true)}
          onRename={handleRename}
          onLogout={onLogout}
        />
      )}

      {/* Rename modal */}
      {showRename && (
        <div
          className="fixed inset-0 z-50 bg-night-950/85 flex items-center justify-center px-4"
          onClick={() => setShowRename(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-moon-400/40 bg-night-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-moon-300 font-display text-lg mb-4 text-center">Đổi tên</h2>
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={20}
              onKeyDown={(e) => e.key === 'Enter' && saveRename()}
              className="w-full rounded-full bg-night-950 border border-moon-400/40 px-4 py-2.5 text-center text-parchment-100 outline-none focus:ring-1 focus:ring-moon-400"
            />
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setShowRename(false)}
                className="flex-1 rounded-full border border-moon-400/40 py-2.5 text-sm text-moon-300 hover:bg-moon-400/10"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={saveRename}
                className="flex-1 rounded-full bg-moon-400 py-2.5 text-sm font-semibold text-night-950 hover:bg-moon-300"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Avatar picker */}
      {showAvatarPicker && (
        <div
          className="fixed inset-0 z-50 bg-night-950/85 flex items-center justify-center px-4"
          onClick={() => setShowAvatarPicker(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-moon-400/40 bg-night-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-moon-300 font-display text-lg mb-4 text-center">Chọn ảnh đại diện</h2>

            <div className="grid grid-cols-5 gap-3">
              {PRESET_AVATARS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  onClick={() => {
                    onAvatarChange(preset.src);
                    setShowAvatarPicker(false);
                  }}
                  className={`aspect-square rounded-full overflow-hidden border-2 transition-transform hover:scale-105 ${
                    avatarUrl === preset.src ? 'border-moon-400' : 'border-transparent'
                  }`}
                >
                  <img src={preset.src} alt={preset.label} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="w-full mt-5 rounded-full border border-moon-400/50 py-2.5 text-sm text-moon-300 hover:bg-moon-400/10"
            >
              Tải ảnh từ máy...
            </button>
          </div>
        </div>
      )}

      {showFriends && <FriendsPanel onClose={() => setShowFriends(false)} />}
      {showChat && (
        <ChatPanel
          onClose={() => setShowChat(false)}
          unreadFrom={unreadFrom}
          onMarkRead={markThreadRead}
        />
      )}
    </div>
  );
}
