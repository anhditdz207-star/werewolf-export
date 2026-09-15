import { useState } from 'react';
import { ClientEvents, DEFAULT_ROOM_CONFIG, RoleName, RoomConfig } from '@werewolf/shared';
import { socket } from '../lib/socket';
import { useGameDispatch } from '../store/GameContext';
import './CreateRoomPage.css';

interface CreateRoomPageProps {
  nickname: string;
  avatarUrl: string | null;
  onRoomCreated: (roomId: string) => void;
  onCancel: () => void;
  onOpenCardGallery: () => void;
}

type AckResponse = { roomId: string; playerId: string };

// Full 25-role roster (matches the 40-card ruleset). All roles listed here
// now have real night-action/win-condition logic on the server.
const ROLES = [
  'Tiên Tri', 'Phù Thủy', 'Thợ Săn', 'Bảo Vệ', 'Già Làng',
  'Thần Tình Yêu', 'Cô Bé', 'Ăn Trộm', 'Thằng Ngốc', 'Kẻ Thế Thân',
  'Chị Em Sinh Đôi', 'Ba Anh Em', 'Hiệp Sĩ Kiếm Rỉ', 'Thẩm Phán Hoen Ố',
  'Người Nuôi Gấu', 'Hầu Gái', 'Cáo', 'Sói Con', 'Sói Cha',
  'Sói Đầu Đàn', 'Sói Trắng', 'Người Thổi Sáo', 'Thiên Sứ',
  'Giáo Chủ', 'Kẻ Hoang Dã',
];

const ROLE_NAME_MAP: Record<string, RoleName> = {
  'Tiên Tri': RoleName.SEER,
  'Phù Thủy': RoleName.WITCH,
  'Thợ Săn': RoleName.HUNTER,
  'Bảo Vệ': RoleName.GUARD,
  'Thần Tình Yêu': RoleName.CUPID,
  'Già Làng': RoleName.ELDER,
  'Cô Bé': RoleName.LITTLE_GIRL,
  'Ăn Trộm': RoleName.THIEF,
  'Thằng Ngốc': RoleName.IDIOT,
  'Kẻ Thế Thân': RoleName.SCAPEGOAT,
  'Chị Em Sinh Đôi': RoleName.TWIN_SISTERS,
  'Ba Anh Em': RoleName.THREE_BROTHERS,
  'Hiệp Sĩ Kiếm Rỉ': RoleName.RUSTY_KNIGHT,
  'Thẩm Phán Hoen Ố': RoleName.CORRUPT_JUDGE,
  'Người Nuôi Gấu': RoleName.BEAR_TAMER,
  'Hầu Gái': RoleName.MAID,
  'Cáo': RoleName.FOX,
  'Sói Con': RoleName.WOLF_CUB,
  'Sói Cha': RoleName.FATHER_WOLF,
  'Sói Đầu Đàn': RoleName.ALPHA_WOLF,
  'Sói Trắng': RoleName.WHITE_WOLF,
  'Người Thổi Sáo': RoleName.FLUTIST,
  'Thiên Sứ': RoleName.ANGEL,
  'Giáo Chủ': RoleName.CULT_LEADER,
  'Kẻ Hoang Dã': RoleName.WILD_CHILD,
};

const ROLE_SLOT_COST: Record<string, number> = {
  'Chị Em Sinh Đôi': 2,
  'Ba Anh Em': 3,
};

function clamp(val: number, min: number, max: number) {
  if (Number.isNaN(val)) return min;
  return Math.min(max, Math.max(min, val));
}

export function CreateRoomPage({ nickname, avatarUrl, onRoomCreated, onCancel, onOpenCardGallery }: CreateRoomPageProps) {
  const dispatch = useGameDispatch();
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [wolfCount, setWolfCount] = useState<number | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [capError, setCapError] = useState(false);
  const [electMayor, setElectMayor] = useState(false);

  const selectedSlots = [...selectedRoles].reduce((sum, name) => sum + (ROLE_SLOT_COST[name] ?? 1), 0);
  const allocated = (wolfCount ?? 0) + selectedSlots;
  const villagerCount = playerCount === null ? null : Math.max(0, playerCount - allocated);
  const atCap = playerCount !== null && allocated >= playerCount;

  function flashCapError() {
    setCapError(true);
    setTimeout(() => setCapError(false), 600);
  }

  function bumpWolf(delta: number) {
    setWolfCount((v) => {
      const cur = v ?? 0;
      const next = cur + delta;
      if (next < 0) return v;
      if (delta > 0 && playerCount !== null && next + selectedSlots > playerCount) {
        flashCapError();
        return v;
      }
      return next;
    });
  }

  function toggleRole(name: string) {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
        return next;
      }
      const cost = ROLE_SLOT_COST[name] ?? 1;
      const nextSlots = [...next].reduce((sum, n) => sum + (ROLE_SLOT_COST[n] ?? 1), 0) + cost;
      if (playerCount !== null && (wolfCount ?? 0) + nextSlots > playerCount) {
        flashCapError();
        return prev;
      }
      next.add(name);
      return next;
    });
  }

  function handleCreate() {
    if (!playerCount) {
      flashCapError();
      return;
    }
    setBusy(true);

    const roleCounts: Partial<Record<RoleName, number>> = { [RoleName.WEREWOLF]: clamp(wolfCount ?? 0, 0, 40) };
    for (const name of selectedRoles) {
      const mapped = ROLE_NAME_MAP[name];
      if (mapped) roleCounts[mapped] = ROLE_SLOT_COST[name] ?? 1;
    }
    const config: RoomConfig = { ...DEFAULT_ROOM_CONFIG, maxPlayers: playerCount, roleCounts, electMayor };

    socket.emit(ClientEvents.ROOM_CREATE, { nickname, avatarUrl }, (res: AckResponse) => {
      dispatch({ type: 'SET_MY_PLAYER_ID', playerId: res.playerId });
      socket.emit(ClientEvents.ROOM_UPDATE_CONFIG, { config });
      onRoomCreated(res.roomId);
    });
  }

  return (
    <div className="cr-stage">
      <button
        type="button"
        onClick={onCancel}
        style={{ position: 'fixed', top: '2vh', left: '2vw', zIndex: 5 }}
        className="cr-back-link"
      >
        ‹ Quay lại
      </button>

      <div className="cr-content">
        <div className="cr-panel-wrap">
          <div className="ctrl player-count-ctrl">
            <input
              type="number"
              className="input-field"
              min={5}
              max={40}
              value={playerCount ?? ''}
              placeholder="-"
              onChange={(e) => setPlayerCount(e.target.value === '' ? null : clamp(Number(e.target.value), allocated, 40))}
              onBlur={() => setPlayerCount((v) => (v === null ? null : clamp(v, Math.max(5, allocated), 40)))}
              inputMode="numeric"
            />
            <button
              type="button"
              className="spin spin-up"
              onClick={() => setPlayerCount((v) => clamp((v ?? 4) + 1, 5, 40))}
              aria-label="Tăng số người chơi"
            />
            <button
              type="button"
              className="spin spin-down"
              onClick={() => setPlayerCount((v) => (v === null ? null : (v - 1 < Math.max(5, allocated) ? v : v - 1)))}
              aria-label="Giảm số người chơi"
            />
          </div>

          <div className="ctrl wolf-ctrl">
            <input
              type="number"
              className="input-field"
              min={0}
              value={wolfCount ?? ''}
              placeholder="-"
              readOnly
            />
            <button type="button" className="spin spin-up" onClick={() => bumpWolf(1)} aria-label="Tăng số Ma Sói" disabled={atCap} />
            <button type="button" className="spin spin-down" onClick={() => bumpWolf(-1)} aria-label="Giảm số Ma Sói" />
          </div>

          <div className="ctrl villager-ctrl">
            <input
              type="number"
              className="input-field"
              value={villagerCount ?? ''}
              placeholder="-"
              readOnly
              title="Tự động tính = Số người chơi − các vai đã chọn"
            />
          </div>

          {capError && (
            <p style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', color: '#ff8080', fontSize: 13, whiteSpace: 'nowrap' }}>
              Đã đủ {playerCount} người — giảm bớt vai khác trước
            </p>
          )}

          <div className="role-list-wrap">
            <div className="role-list">
              {ROLES.map((name) => (
                <div className="role-row" key={name}>
                  <span className="role-name">{name}</span>
                  <label className="cr-switch">
                    <input
                      type="checkbox"
                      checked={selectedRoles.has(name)}
                      disabled={atCap && !selectedRoles.has(name)}
                      onChange={() => toggleRole(name)}
                    />
                    <span className="cr-slider" />
                  </label>
                </div>
              ))}

              <p
                className="role-name"
                style={{
                  gridColumn: '1 / -1',
                  marginTop: '10px',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(255, 214, 140, 0.4)',
                  color: '#ffd68c',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                }}
              >
                ◆ Chế độ đặc biệt
              </p>
              <div className="role-row" style={{ gridColumn: '1 / -1' }}>
                <span className="role-name">Bầu Trưởng Làng</span>
                <label className="cr-switch">
                  <input type="checkbox" checked={electMayor} onChange={() => setElectMayor((v) => !v)} />
                  <span className="cr-slider" />
                </label>
              </div>
            </div>
          </div>
        </div>

        <button type="button" className="create-btn" onClick={handleCreate} disabled={busy} aria-label="Tạo phòng" />
      </div>

      <button type="button" className="cr-list-btn" onClick={onOpenCardGallery} aria-label="Danh sách" />
    </div>
  );
}
