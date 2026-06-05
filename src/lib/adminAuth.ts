import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { AdminAuth } from "@/models/AdminAuth";
import { AdminSession } from "@/models/AdminSession";

export const ADMIN_COOKIE = "cs_admin_session";
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PIN = "2026";

function hashPin(pin: string, salt: string) {
  return scryptSync(pin, salt, 64).toString("hex");
}

// 싱글턴 설정 문서를 보장한다. 없으면 기본 PIN(2026)으로 생성.
async function ensureAdminAuth() {
  await connectDB();
  let auth = await AdminAuth.findById("singleton");
  if (!auth) {
    const salt = randomBytes(16).toString("hex");
    auth = await AdminAuth.create({ _id: "singleton", salt, pinHash: hashPin(DEFAULT_PIN, salt) });
  }
  return auth;
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const auth = await ensureAdminAuth();
    const candidate = Buffer.from(hashPin(pin, auth.salt), "hex");
    const stored = Buffer.from(auth.pinHash, "hex");
    if (candidate.length !== stored.length) return false;
    return timingSafeEqual(candidate, stored);
  } catch {
    return false;
  }
}

export async function changePin(newPin: string): Promise<void> {
  const auth = await ensureAdminAuth();
  const salt = randomBytes(16).toString("hex");
  auth.salt = salt;
  auth.pinHash = hashPin(newPin, salt);
  await auth.save();
  // 비밀번호 변경 시 기존 세션은 모두 무효화한다.
  await AdminSession.deleteMany({});
}

export async function createSession() {
  await connectDB();
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await AdminSession.create({ token, expiresAt });
  return { token, expiresAt };
}

export async function isAuthed(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  try {
    await connectDB();
    const session = await AdminSession.findOne({ token });
    if (!session) return false;
    if (session.expiresAt < new Date()) {
      await AdminSession.deleteOne({ token });
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// 어드민 보호 API에서 사용하는 가드 — 인증 안 되어 있으면 401 응답을 반환, 인증되어 있으면 null.
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAuthed()) {
    return null;
  }
  return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return;
  try {
    await connectDB();
    await AdminSession.deleteOne({ token });
  } catch {
    // ignore
  }
}
