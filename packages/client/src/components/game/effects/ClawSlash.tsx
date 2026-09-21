import './ClawSlash.css';

interface ClawSlashProps {
  /** Triggers the 3-strike slash + red flash animation. */
  active: boolean;
}

/**
 * The werewolf 3-claw slash effect — originally built for the morning
 * death announcement, now reused as-is for the werewolf's own kill
 * action (see RoleActionEffect). Kept as a small standalone piece so it
 * has exactly one implementation instead of being copy-pasted.
 */
export function ClawSlash({ active }: ClawSlashProps) {
  return (
    <>
      <div className="claw-flash" data-active={active} />
      <div className="claw-marks" data-active={active}>
        <div className="claw-mark" style={{ ['--ty' as string]: '-78px', ['--rot' as string]: '-34deg' }} />
        <div className="claw-mark" style={{ ['--ty' as string]: '-14px', ['--rot' as string]: '-38deg' }} />
        <div className="claw-mark" style={{ ['--ty' as string]: '48px', ['--rot' as string]: '-30deg' }} />
      </div>
    </>
  );
}
