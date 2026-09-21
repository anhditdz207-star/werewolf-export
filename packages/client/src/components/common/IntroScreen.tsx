import { useEffect, useRef, useState } from 'react';
import { CARD_CATALOG } from '../../data/cardCatalog';
import { PRESET_AVATARS } from '../../data/presetAvatars';

interface IntroScreenProps {
  onFinish: () => void;
}

/**
 * Full-screen black intro that plays a short splash video while the app
 * "loads", then hands off to whatever comes next (App.tsx already decides
 * Login vs Lobby based on the saved nickname).
 *
 * Data-saver aware:
 * - If the browser reports Save-Data mode, or the connection is 2g/slow-2g,
 *   or the user has `prefers-reduced-motion`, we load the small "lite"
 *   video (or skip straight past it) instead of the full-size one.
 */

const NORMAL_SRC = '/intro/intro.mp4';
const LITE_SRC = '/intro/intro-lite.mp4';
const POSTER_SRC = '/intro/intro-poster.jpg';

// Every background/panel/button image and icon used anywhere in the app,
// fetched once here, in the background, while the intro plays, so they're
// already in the browser cache by the time the player reaches each screen
// — no more visible pop-in/progressive loading when opening Login, Lobby,
// Chat, Friends, Settings, Create Room, Join Room, the card gallery, or an
// in-game Day/Night background. Card art and avatars are pulled from their
// respective catalogs so this list can't drift out of sync with them.
const STATIC_UI_IMAGES = [
  '/favicon-32.png',
  '/apple-touch-icon.png',
  '/ui/login/background.png',
  '/ui/login/login_box.png',
  '/ui/login/google_signin_button.png',
  '/ui/login/play_now_button.png',
  '/ui/lobby/background_lobby.png',
  '/ui/lobby/player_profile_frame.png',
  '/ui/lobby/frame_containing_buttons.png',
  '/ui/lobby/room_creation_box.png',
  '/ui/lobby/enter_room_box.png',
  '/ui/lobby/chat_button.png',
  '/ui/lobby/friends_button.png',
  '/ui/lobby/list_button.png',
  '/ui/lobby/three_line_button.png',
  '/ui/friends/background.png',
  '/ui/friends/khung.png',
  '/ui/chat/background.png',
  '/ui/chat/frame.png',
  '/ui/chat/admin_avatar.png',
  '/ui/createroom/background.png',
  '/ui/createroom/panel.png',
  '/ui/createroom/create_button.png',
  '/ui/createroom/list_button.png',
  '/ui/join/background_lobby.png',
  '/ui/join/join_panel.png',
  '/ui/join/join_button.png',
  '/ui/join/list_button.png',
  '/ui/settings/settings_panel.png',
  '/ui/settings/exit_button.png',
  '/ui/settings/logout_button.png',
  '/ui/room/icon_chat.png',
  '/ui/room/icon_settings.png',
  '/ui/room/morning_background.jpg',
  '/ui/room/night_background.jpg',
  '/cards/full/back.jpg',
  '/cards/thumb/back.jpg',
];

function buildPreloadList(): string[] {
  return [
    ...STATIC_UI_IMAGES,
    ...PRESET_AVATARS.map((a) => a.src),
    ...CARD_CATALOG.flatMap((c) => [`/cards/thumb/${c.id}.jpg`, `/cards/full/${c.id}.jpg`]),
  ];
}

function preloadImages(fullSet: boolean): void {
  // On a data-saver connection, don't burn ~35MB of images the person may
  // never open — just preload the small, always-visible set (still covers
  // the very first screens) and let everything else lazy-load as normal.
  const list = fullSet ? buildPreloadList() : STATIC_UI_IMAGES.slice(0, 4);
  for (const src of list) {
    const img = new Image();
    img.src = src;
  }
}

// Absolute safety net: never let a stuck/blocked video trap the user on the
// splash screen forever.
const MAX_WAIT_MS = 9000;

function shouldUseDataSaver(): boolean {
  if (typeof navigator === 'undefined') return false;

  // Network Information API (Chrome/Android/Edge). Not typed in lib.dom yet.
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (conn) {
    if (conn.saveData) return true;
    if (typeof conn.effectiveType === 'string' && /2g/.test(conn.effectiveType)) return true;
  }

  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-data: reduce)').matches) {
    return true;
  }

  return false;
}

function shouldSkipVideoEntirely(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  // On a genuinely slow connection, don't even fetch the small clip —
  // go straight through after a brief, cheap black flash.
  return !!conn?.saveData && typeof conn.effectiveType === 'string' && /2g/.test(conn.effectiveType);
}

export function IntroScreen({ onFinish }: IntroScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [skipVideo] = useState(shouldSkipVideoEntirely);
  const [dataSaver] = useState(shouldUseDataSaver);
  const [fadingOut, setFadingOut] = useState(false);
  const finishedRef = useRef(false);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFadingOut(true);
    // Let the fade-out transition play before unmounting.
    setTimeout(onFinish, 220);
  }

  useEffect(() => {
    preloadImages(!dataSaver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skipVideo) {
      const t = setTimeout(finish, 500);
      return () => clearTimeout(t);
    }

    const timeout = setTimeout(finish, MAX_WAIT_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipVideo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || skipVideo) return;
    video.play().catch(() => {
      // Autoplay blocked (rare, since it's muted) — don't strand the user.
      finish();
    });
  }, [skipVideo]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-200 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {!skipVideo && (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={dataSaver ? LITE_SRC : NORMAL_SRC}
          poster={POSTER_SRC}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={finish}
          onError={finish}
        />
      )}
      <button
        type="button"
        onClick={finish}
        className="absolute bottom-6 right-6 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80 backdrop-blur transition hover:bg-white/20"
      >
        Bỏ qua
      </button>
    </div>
  );
}
