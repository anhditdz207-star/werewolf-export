import { useState } from 'react';
import { ClientEvents } from '@werewolf/shared';
import { socket } from '../lib/socket';
import { useGameDispatch } from '../store/GameContext';
import './JoinRoomPage.css';

interface JoinRoomPageProps {
  nickname: string;
  avatarUrl: string | null;
  onRoomJoined: (roomId: string) => void;
  onCancel: () => void;
  onOpenCardGallery: () => void;
}

type AckResponse = { roomId: string; playerId: string };

export function JoinRoomPage({ nickname, avatarUrl, onRoomJoined, onCancel, onOpenCardGallery }: JoinRoomPageProps) {
  const dispatch = useGameDispatch();
  const [roomId, setRoomId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleJoin() {
    const id = roomId.trim().toUpperCase();
    if (!id) {
      setError('Vui lòng nhập ID phòng.');
      return;
    }
    setBusy(true);
    setError(null);
    socket.emit(ClientEvents.ROOM_JOIN, { roomId: id, nickname, avatarUrl }, (res: AckResponse) => {
      dispatch({ type: 'SET_MY_PLAYER_ID', playerId: res.playerId });
      onRoomJoined(res.roomId);
    });
  }

  return (
    <div className="jr-stage">
      <div className="jr-content">
        <div className="jr-panel-wrap">
          <input
            type="text"
            className="room-input"
            placeholder="Nhập ID phòng..."
            maxLength={8}
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            autoFocus
          />
          <button type="button" className="join-btn" onClick={handleJoin} disabled={busy} aria-label="Tham gia" />
          <button type="button" className="jr-back-link" onClick={onCancel}>
            QUAY LẠI
          </button>
        </div>
        {error && <p style={{ color: '#e07a7a', marginTop: 12, fontSize: 14 }}>{error}</p>}
      </div>

      <button type="button" className="jr-list-btn" onClick={onOpenCardGallery} aria-label="Danh sách" />
    </div>
  );
}
