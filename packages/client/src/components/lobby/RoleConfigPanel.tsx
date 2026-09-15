import { useState } from 'react';
import { ClientEvents, RoleName, ROLE_DEFINITIONS, RoomConfig } from '@werewolf/shared';
import { socket } from '../../lib/socket';

interface RoleConfigPanelProps {
  config: RoomConfig;
  playerCount: number;
}

const SINGLE_INSTANCE_ROLES = [
  RoleName.SEER,
  RoleName.GUARD,
  RoleName.WITCH,
  RoleName.HUNTER,
  RoleName.CUPID,
];

export function RoleConfigPanel({ config, playerCount }: RoleConfigPanelProps) {
  const [roleCounts, setRoleCounts] = useState(config.roleCounts);

  function updateConfig(next: Partial<Record<RoleName, number>>) {
    setRoleCounts(next);
    socket.emit(ClientEvents.ROOM_UPDATE_CONFIG, {
      config: { ...config, roleCounts: next },
    });
  }

  function setWerewolfCount(count: number) {
    updateConfig({ ...roleCounts, [RoleName.WEREWOLF]: Math.max(0, count) });
  }

  function toggleSingleRole(role: RoleName) {
    const current = roleCounts[role] ?? 0;
    updateConfig({ ...roleCounts, [role]: current > 0 ? 0 : 1 });
  }

  function handleStart() {
    socket.emit(ClientEvents.ROOM_START);
  }

  const totalAssigned = Object.values(roleCounts).reduce((sum, n) => sum + (n ?? 0), 0);

  return (
    <div className="rounded-xl border border-mist-600/40 bg-night-800 p-4 space-y-4">
      <h3 className="text-sm text-mist-400">Cấu hình vai trò (chủ phòng)</h3>

      <div className="flex items-center justify-between">
        <span>{ROLE_DEFINITIONS[RoleName.WEREWOLF].displayNameVi}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-7 w-7 rounded bg-night-700 hover:bg-night-700/70"
            onClick={() => setWerewolfCount((roleCounts[RoleName.WEREWOLF] ?? 0) - 1)}
          >
            −
          </button>
          <span className="w-6 text-center font-mono">{roleCounts[RoleName.WEREWOLF] ?? 0}</span>
          <button
            type="button"
            className="h-7 w-7 rounded bg-night-700 hover:bg-night-700/70"
            onClick={() => setWerewolfCount((roleCounts[RoleName.WEREWOLF] ?? 0) + 1)}
          >
            +
          </button>
        </div>
      </div>

      {SINGLE_INSTANCE_ROLES.map((role) => (
        <label key={role} className="flex items-center justify-between cursor-pointer">
          <span>{ROLE_DEFINITIONS[role].displayNameVi}</span>
          <input
            type="checkbox"
            checked={(roleCounts[role] ?? 0) > 0}
            onChange={() => toggleSingleRole(role)}
            className="h-5 w-5 accent-moon-400"
          />
        </label>
      ))}

      <p className="text-xs text-mist-400">
        Đã gán {totalAssigned}/{playerCount} người chơi (còn lại tự động là Dân thường).
      </p>

      <button
        type="button"
        onClick={handleStart}
        className="w-full rounded-lg bg-moon-400 py-2.5 font-semibold text-night-950 hover:bg-moon-300 transition-colors"
      >
        Bắt đầu ván đấu
      </button>
    </div>
  );
}
