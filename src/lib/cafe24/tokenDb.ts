import mongoose from "mongoose";

// cafe24 refresh_token 은 1회용(rotation) 이므로 yogiChat 과 같은 refresh_token 을
// 다른 DB 에서 갱신하면 서로가 invalid_grant 를 유발한다.
// 따라서 tokens 컬렉션만 yogiChat 의 DB 를 공유해서 단일 source of truth 를 유지한다.
//
// CAFE24_TOKEN_MONGODB_URI 가 설정돼 있으면 그 URI 로 별도 mongoose 연결을 생성하고,
// 없으면 기본 MONGODB_URI 를 재사용 (개발/테스트 편의).
const CAFE24_TOKEN_MONGODB_URI = process.env.CAFE24_TOKEN_MONGODB_URI ?? process.env.MONGODB_URI;

type CachedConnection = {
  conn: mongoose.Connection | null;
  promise: Promise<mongoose.Connection> | null;
};

const globalWithTokenDb = global as typeof globalThis & {
  cafe24TokenDb?: CachedConnection;
};

const cached = globalWithTokenDb.cafe24TokenDb ?? { conn: null, promise: null };
globalWithTokenDb.cafe24TokenDb = cached;

export async function connectTokenDB(): Promise<mongoose.Connection> {
  if (cached.conn) return cached.conn;

  if (!CAFE24_TOKEN_MONGODB_URI) {
    throw new Error("CAFE24_TOKEN_MONGODB_URI 또는 MONGODB_URI 가 필요합니다.");
  }

  cached.promise ??= mongoose
    .createConnection(CAFE24_TOKEN_MONGODB_URI, {
      bufferCommands: false,
    })
    .asPromise();

  cached.conn = await cached.promise;
  return cached.conn;
}
