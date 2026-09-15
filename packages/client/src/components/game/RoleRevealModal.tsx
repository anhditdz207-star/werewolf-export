import { RoleAssignedPayload, ROLE_DEFINITIONS } from '@werewolf/shared';

interface RoleRevealModalProps {
  roleInfo: RoleAssignedPayload;
  teammateNicknames: string[];
}

export function RoleRevealModal({ roleInfo, teammateNicknames }: RoleRevealModalProps) {
  const def = ROLE_DEFINITIONS[roleInfo.role];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/90 backdrop-blur-sm p-4">
      <div className="max-w-sm w-full rounded-2xl border border-moon-400/40 bg-night-800 p-6 text-center space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-mist-400">Vai trò của bạn</p>
        <h2 className="text-4xl font-display font-semibold text-moon-400">{def.displayNameVi}</h2>
        <p className="text-sm text-parchment-100/90 leading-relaxed">{def.descriptionVi}</p>
        {teammateNicknames.length > 0 && (
          <div className="pt-2 border-t border-mist-600/30">
            <p className="text-xs text-mist-400 mb-1">Đồng đội của bạn:</p>
            <p className="text-blood-500 font-medium">{teammateNicknames.join(', ')}</p>
          </div>
        )}
        <p className="text-xs text-mist-400 pt-2">Đêm đầu tiên sắp bắt đầu...</p>
      </div>
    </div>
  );
}
