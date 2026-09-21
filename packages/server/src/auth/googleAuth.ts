import { Express, Request, Response } from 'express';

interface GoogleUserInfo {
  name?: string;
  email?: string;
  picture?: string;
  sub?: string;
}

/**
 * POST /api/auth/google
 * Body: { accessToken: string }
 *
 * We don't keep any user accounts/sessions server-side — this endpoint just
 * verifies that the access token the client got from Google's OAuth token
 * client is real, by asking Google's own userinfo endpoint for the profile
 * it belongs to. If Google accepts the token, we trust the returned name
 * and profile picture and hand them back to the client to use as their
 * nickname/avatar, the same way a guest nickname is used elsewhere.
 */
export function registerAuthRoutes(app: Express): void {
  app.post('/api/auth/google', async (req: Request, res: Response) => {
    const accessToken = req.body?.accessToken;
    if (!accessToken || typeof accessToken !== 'string') {
      res.status(400).json({ message: 'Thiếu access token.' });
      return;
    }

    try {
      const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!googleRes.ok) {
        res.status(401).json({ message: 'Token Google không hợp lệ hoặc đã hết hạn.' });
        return;
      }

      const profile = (await googleRes.json()) as GoogleUserInfo;
      if (!profile.sub) {
        res.status(401).json({ message: 'Không thể xác thực tài khoản Google.' });
        return;
      }

      res.json({
        nickname: profile.name ?? 'Người chơi Google',
        avatarUrl: profile.picture ?? null,
        googleId: profile.sub,
      });
    } catch {
      res.status(502).json({ message: 'Không thể liên hệ máy chủ Google, vui lòng thử lại.' });
    }
  });
}
