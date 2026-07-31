import type { NextFunction, Request, Response } from 'express';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { pool } from './db.js';

initializeApp({ credential: applicationDefault() });

export type Role = 'member' | 'leader' | 'board' | 'retired';

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  role: Role;
  team_id: number | null;
  slack_id: string | null;
  created_at: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      uid?: string;
      profile?: Profile;
    }
  }
}

/** Auto-create profile on first authenticated request (replaces the old Supabase auth.users trigger). */
async function ensureProfile(uid: string, email: string, displayName: string): Promise<Profile> {
  const existing = await pool.query<Profile>('SELECT * FROM profiles WHERE id = $1', [uid]);
  if (existing.rows[0]) return existing.rows[0];

  const inv = await pool.query<{ id: number; role: Role; team_id: number | null }>(
    "SELECT id, role, team_id FROM invitations WHERE email = $1 AND status = 'pending' LIMIT 1",
    [email],
  );

  const role = inv.rows[0]?.role ?? 'member';
  const teamId = inv.rows[0]?.team_id ?? null;

  const created = await pool.query<Profile>(
    `INSERT INTO profiles (id, display_name, email, role, team_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING *`,
    [uid, displayName, email, role, teamId],
  );

  if (inv.rows[0]) {
    await pool.query("UPDATE invitations SET status = 'accepted' WHERE id = $1", [inv.rows[0].id]);
  }

  return created.rows[0];
}

/** Verifies the Firebase ID token and attaches req.uid + req.profile. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing bearer token' });
    return;
  }
  try {
    const decoded = await getAuth().verifyIdToken(header.slice('Bearer '.length));
    if (!decoded.email || !decoded.email.endsWith('@widsley.com')) {
      res.status(403).json({ error: 'domain not allowed' });
      return;
    }
    req.uid = decoded.uid;
    req.profile = await ensureProfile(decoded.uid, decoded.email, decoded.name ?? decoded.email);
    if (req.profile.role === 'retired') {
      res.status(403).json({ error: 'account retired' });
      return;
    }
    next();
  } catch (err) {
    res.status(401).json({ error: 'invalid token', detail: (err as Error).message });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.profile || !roles.includes(req.profile.role)) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    next();
  };
}
