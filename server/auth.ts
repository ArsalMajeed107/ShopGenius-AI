import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db.ts";

const SECRET = process.env.SESSION_SECRET || "shopgenius-local-dev-secret-key-2026";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url: string;
  email_verified: number;
}

export interface AuthedRequest extends Request {
  user?: AuthUser | null;
  sessionId?: string;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

export function signToken(payload: { userId: number; role: string }): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const body = base64UrlEncode(JSON.stringify({ ...payload, exp }));
  const signature = base64UrlEncode(
    crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): { userId: number; role: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = base64UrlEncode(
      crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest()
    );
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const decoded = JSON.parse(base64UrlDecode(body)) as { userId: number; role: string; exp: number };
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx > -1) {
      const key = part.slice(0, idx).trim();
      const val = decodeURIComponent(part.slice(idx + 1).trim());
      out[key] = val;
    }
  }
  return out;
}

export function attachAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const cookies = parseCookies(req.headers.cookie);
  let sessionId = cookies["sg_sid"] || (req.headers["x-session-id"] as string | undefined);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    res.cookie("sg_sid", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 30,
      path: "/",
    });
  }
  req.sessionId = sessionId;

  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = bearer || cookies["sg_token"] || null;

  if (token) {
    const verified = verifyToken(token);
    if (verified) {
      const user = db
        .prepare("SELECT id, name, email, role, avatar_url, email_verified FROM users WHERE id = ?")
        .get(verified.userId) as AuthUser | undefined;
      req.user = user || null;
      return next();
    }
  }
  req.user = null;
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required. Please sign in to continue." });
    return;
  }
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Administrator privileges required." });
    return;
  }
  next();
}
