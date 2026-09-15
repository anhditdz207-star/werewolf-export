import { useState } from 'react';
import { Player } from '@werewolf/shared';
import { audioManager } from '../../lib/audio';

interface InRoomSettingsPanelProps {
  players: Player[];
  myPlayerId: string | null;
  onClose: () => void;
  onLeaveRoom: () => void;
  /** Called after master volume changes so live voice-chat audio elements can re-apply it. */
  onMasterVolumeChange?: () => void;
  /** Called with a peerId after that player's listen volume changes. */
  onPlayerVolumeChange?: (playerId: string) => void;
  /** Called after mic input volume changes so the live GainNode updates immediately. */
  onMicVolumeChange?: () => void;
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm text-parchment-100 mb-1">
        <span>{label}</span>
        <span className="text-mist-400">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full accent-moon-400"
      />
    </div>
  );
}

export function InRoomSettingsPanel({
  players,
  myPlayerId,
  onClose,
  onLeaveRoom,
  onMasterVolumeChange,
  onPlayerVolumeChange,
  onMicVolumeChange,
}: InRoomSettingsPanelProps) {
  const [master, setMaster] = useState(audioManager.getMasterVolume());
  const [bgm, setBgm] = useState(audioManager.getBgmVolume());
  const [sfx, setSfx] = useState(audioManager.getSfxVolume());
  const [mic, setMic] = useState(audioManager.getMicVolume());
  const [playerVols, setPlayerVols] = useState<Record<string, number>>(() =>
    Object.fromEntries(players.map((p) => [p.id, audioManager.getPlayerVolume(p.id)])),
  );

  function setPlayerVolume(playerId: string, v: number) {
    audioManager.setPlayerVolume(playerId, v);
    setPlayerVols((prev) => ({ ...prev, [playerId]: v }));
    onPlayerVolumeChange?.(playerId);
  }

  const others = players.filter((p) => p.id !== myPlayerId);

  return (
    <div className="fixed inset-0 z-50 bg-night-950/85 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-moon-400/40 bg-night-900 p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-moon-300 font-display text-lg mb-4 text-center">Cài đặt phòng chơi</h2>

        <Slider
          label="Âm lượng tổng"
          value={master}
          onChange={(v) => {
            setMaster(v);
            audioManager.setMasterVolume(v);
            onMasterVolumeChange?.();
          }}
        />
        <Slider label="Nhạc nền" value={bgm} onChange={(v) => { setBgm(v); audioManager.setBgmVolume(v); }} />
        <Slider label="Hiệu ứng âm thanh" value={sfx} onChange={(v) => { setSfx(v); audioManager.setSfxVolume(v); }} />
        <Slider
          label="Mic đầu vào"
          value={mic}
          onChange={(v) => {
            setMic(v);
            audioManager.setMicVolume(v);
            onMicVolumeChange?.();
          }}
        />

        {others.length > 0 && (
          <>
            <p className="text-mist-400 text-xs uppercase tracking-wide mt-5 mb-2">Âm lượng nghe từng người</p>
            {others.map((p) => (
              <Slider
                key={p.id}
                label={p.nickname}
                value={playerVols[p.id] ?? 1}
                onChange={(v) => setPlayerVolume(p.id, v)}
              />
            ))}
          </>
        )}

        <button
          type="button"
          onClick={onLeaveRoom}
          className="w-full mt-4 rounded-full border border-blood-500/50 text-blood-500 py-2.5 text-sm font-semibold hover:bg-blood-500/10"
        >
          Rời phòng
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-2 rounded-full border border-moon-400/40 py-2.5 text-sm text-moon-300 hover:bg-moon-400/10"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
