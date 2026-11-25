import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const DEFAULT_SUPABASE_URL = 'https://mqvfpuqhlgbhoiwciwpr.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_i9AtKDyTEULSJ7s0UQ6kww_lOxxOKd0';

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || '').trim() || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (process.env.VITE_SUPABASE_ANON_KEY || '').trim() || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

// Server-only secret (never prefixed with VITE_)
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const HAS_SERVICE_ROLE_KEY = Boolean(SUPABASE_SERVICE_ROLE_KEY);

interface AuthedCaller {
  userId: string;
  role: 'admin' | 'user';
  token: string;
}

interface AuthedRequest extends Request {
  caller?: AuthedCaller;
}

const baseSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const supabaseAdmin = HAS_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

async function resolveCallerFromToken(token: string): Promise<AuthedCaller | null> {
  const { data: userData, error: authError } = await baseSupabase.auth.getUser(token);
  if (authError || !userData?.user) {
    return null;
  }

  const user = userData.user;
  const scopedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  let role: 'admin' | 'user' = 'user';
  try {
    const { data: profileData } = await scopedClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileData && String(profileData.role || '').toLowerCase() === 'admin') {
      role = 'admin';
    }
  } catch {
    // Fail-closed to role='user' if profiles lookup fails
  }

  return {
    userId: user.id,
    role,
    token,
  };
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    const token = match ? match[1].trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Vui lòng đăng nhập để truy cập dữ liệu.' });
      return;
    }

    const caller = await resolveCallerFromToken(token);
    if (!caller) {
      res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
      return;
    }

    req.caller = caller;
    next();
  } catch {
    res.status(401).json({ error: 'Không thể xác thực phiên đăng nhập.' });
  }
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.caller || req.caller.role !== 'admin') {
    res
      .status(403)
      .json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền thực hiện thao tác này.' });
    return;
  }
  next();
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// Security headers for API responses
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// ADMIN USER MANAGEMENT (Create, Reset Password, Delete)
app.post(
  '/api/admin/users',
  requireAuth,
  requireAdmin,
  async (req: AuthedRequest, res: Response) => {
    try {
      const {
        action,
        username,
        password,
        full_name,
        vehicle_plate,
        member_id,
        user_id,
      } = req.body || {};

      const targetMemberId = String(member_id || user_id || '').trim();
      const targetPlate = String(vehicle_plate || '').trim();

      // If SUPABASE_SERVICE_ROLE_KEY is not set in local env, proxy safely to deployed Supabase Edge Functions
      if (!supabaseAdmin) {
        const edgeFnName = action === 'create' ? 'create-member' : 'manage-member';
        const edgeBody =
          action === 'create'
            ? {
                username: String(username || '').trim().toLowerCase(),
                password: String(password || ''),
                full_name: String(full_name || '').trim(),
                vehicle_plate: targetPlate || null,
              }
            : action === 'reset_password'
              ? {
                  action: 'reset_password',
                  user_id: targetMemberId,
                  member_id: targetMemberId,
                  password: String(password || ''),
                  new_password: String(password || ''),
                }
              : {
                  action: 'delete',
                  user_id: targetMemberId,
                  member_id: targetMemberId,
                };

        const edgeRes = await fetch(`${SUPABASE_URL}/functions/v1/${edgeFnName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${req.caller!.token}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(edgeBody),
        });

        const text = await edgeRes.text();
        let parsed: Record<string, unknown> = {};
        try {
          parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
        } catch {
          parsed = { error: text || 'Lỗi từ máy chủ Edge Function.' };
        }
        return res.status(edgeRes.status).json(parsed);
      }

      if (action === 'create') {
        const cleanUsername = String(username || '').trim().toLowerCase();
        const cleanPassword = String(password || '');
        const cleanFullName = String(full_name || '').trim();

        if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername) || cleanPassword.length < 8) {
          return res
            .status(400)
            .json({ error: 'ID đăng nhập và mật khẩu (tối thiểu 8 ký tự) không hợp lệ.' });
        }

        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('username', cleanUsername)
          .maybeSingle();

        if (existingProfile) {
          return res.status(400).json({ error: `ID đăng nhập "${cleanUsername}" đã tồn tại.` });
        }

        const email = `${cleanUsername}@thai-viet.local`;
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: cleanPassword,
          email_confirm: true,
          user_metadata: { full_name: cleanFullName },
        });

        if (authError || !authData.user) {
          return res
            .status(400)
            .json({ error: authError?.message || 'Không thể tạo tài khoản xác thực.' });
        }

        const userId = authData.user.id;
        const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
          id: userId,
          username: cleanUsername,
          full_name: cleanFullName,
          role: 'user',
        });

        if (profileError) {
          return res
            .status(400)
            .json({ error: profileError.message || 'Không thể tạo hồ sơ thành viên.' });
        }

        if (targetPlate) {
          await supabaseAdmin
            .from('vehicles')
            .update({ driver_id: userId })
            .eq('plate', targetPlate);
        }

        return res.json({ ok: true, userId });
      }

      if (action === 'reset_password') {
        const newPassword = String(password || '');
        if (!targetMemberId || newPassword.length < 8) {
          return res.status(400).json({ error: 'Mật khẩu mới phải có tối thiểu 8 ký tự.' });
        }

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          targetMemberId,
          { password: newPassword }
        );

        if (updateError) {
          return res
            .status(400)
            .json({ error: updateError.message || 'Không thể đặt lại mật khẩu.' });
        }

        return res.json({ ok: true });
      }

      if (action === 'delete') {
        if (!targetMemberId) {
          return res.status(400).json({ error: 'Mã thành viên không hợp lệ.' });
        }

        const { error: unassignErr } = await supabaseAdmin
          .from('vehicles')
          .update({ driver_id: null })
          .eq('driver_id', targetMemberId);

        if (unassignErr) {
          return res.status(400).json({ error: unassignErr.message });
        }

        const { error: deleteAuthErr } = await supabaseAdmin.auth.admin.deleteUser(targetMemberId);
        if (deleteAuthErr) {
          return res
            .status(400)
            .json({ error: deleteAuthErr.message || 'Không thể xóa tài khoản đăng nhập.' });
        }

        const { error: deleteProfileErr } = await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('id', targetMemberId);

        if (deleteProfileErr) {
          return res
            .status(400)
            .json({ error: deleteProfileErr.message || 'Không thể xóa hồ sơ thành viên.' });
        }

        return res.json({ ok: true });
      }

      return res.status(400).json({ error: 'Hành động không hợp lệ.' });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Lỗi xử lý yêu cầu quản lý tài khoản.';
      return res.status(500).json({ error: message });
    }
  }
);

async function startServer(): Promise<void> {
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[fleet-server] Running on http://0.0.0.0:${PORT} (${IS_PROD ? 'prod' : 'dev'})`);
  });
}

startServer().catch((err) => {
  console.error('[fleet-server] Fatal startup error:', err);
  process.exit(1);
});
