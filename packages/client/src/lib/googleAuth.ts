const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';
const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

export interface GoogleProfile {
  nickname: string;
  avatarUrl: string | null;
  googleId?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }): { requestAccessToken: () => void };
        };
      };
    };
  }
}

let scriptLoadPromise: Promise<void> | null = null;

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không thể tải Google Sign-In.'));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

/**
 * Triggers the Google OAuth consent popup (must be called from a direct
 * user click), then verifies the resulting access token with our server
 * and resolves with the profile info to use as nickname/avatar.
 */
export async function signInWithGoogle(): Promise<GoogleProfile> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Đăng nhập Google chưa được cấu hình (thiếu Client ID).');
  }

  await loadGsiScript();

  const accessToken = await new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error('Đăng nhập Google đã bị hủy hoặc thất bại.'));
          return;
        }
        resolve(response.access_token);
      },
    });
    client.requestAccessToken();
  });

  const verifyRes = await fetch(`${SERVER_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken }),
  });

  if (!verifyRes.ok) {
    const body = await verifyRes.json().catch(() => null);
    throw new Error(body?.message ?? 'Xác thực Google thất bại.');
  }

  return (await verifyRes.json()) as GoogleProfile;
}
