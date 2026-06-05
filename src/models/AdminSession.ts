import { model, models, Schema } from "mongoose";

// 어드민 로그인 세션 — 토큰은 랜덤 base64, expiresAt 도달 시 MongoDB TTL이 자동 삭제.
const adminSessionSchema = new Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AdminSession = models.AdminSession || model("AdminSession", adminSessionSchema);
