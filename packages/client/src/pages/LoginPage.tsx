import { useState } from 'react';
import { signInWithGoogle } from '../lib/googleAuth';
import { linkDeviceIdToGoogle } from '../lib/deviceId';

interface LoginPageProps {
  onLogin: (nickname: string, avatarUrl?: string | null) => void;
}

function generateGuestName() {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `Khách${suffix}`;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  function handleGuestPlay() {
    onLogin(generateGuestName());
  }

  async function handleGoogleLogin() {
    setError(null);
    setGoogleBusy(true);
    try {
      const profile = await signInWithGoogle();
      if (profile.googleId) linkDeviceIdToGoogle(profile.googleId);
      onLogin(profile.nickname, profile.avatarUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập Google thất bại.');
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-cover bg-center px-4"
      style={{ backgroundImage: 'url(/ui/login/background.png)' }}
    >
      <div className="relative w-[440px] sm:w-[520px]">
        <img
          src="/ui/login/login_box.png"
          alt="Ma Sói Online"
          className="w-full select-none pointer-events-none drop-shadow-2xl"
          draggable={false}
        />

        <div className="absolute inset-0 flex flex-col items-center justify-end px-[13%] pb-[6%] gap-2.5">
          {error && <p className="text-sm text-blood-500 -mt-1 mb-1">{error}</p>}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleBusy}
            className="w-full max-w-[260px] transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
          >
            <img
              src="/ui/login/google_signin_button.png"
              alt="Đăng nhập với Google"
              className="w-full select-none pointer-events-none"
              draggable={false}
            />
          </button>

          <button
            type="button"
            onClick={handleGuestPlay}
            className="w-full max-w-[260px] transition-transform hover:scale-105 active:scale-95"
          >
            <img
              src="/ui/login/play_now_button.png"
              alt="Chơi ngay (khách)"
              className="w-full select-none pointer-events-none"
              draggable={false}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
