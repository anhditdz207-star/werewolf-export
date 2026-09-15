const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

/**
 * Dependency-free id generator (avoids importing Node's `crypto` module so
 * this file has zero external type dependencies). Not cryptographically
 * secure, which is fine here — player ids only need to be unique within a
 * single room's lifetime, not unguessable.
 *
 * NOTE: if you have full npm registry access (this sandbox's proxy blocks
 * @types/node), feel free to swap this for `randomUUID()` from 'crypto'.
 */
export function generatePlayerId(): string {
  const random = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random()}-${random()}`;
}
