import { model, models, Schema } from "mongoose";

// 단일 어드민 비밀번호 설정 (싱글턴 문서). 비밀번호는 scrypt 해시 + 솔트로 저장.
const adminAuthSchema = new Schema(
  {
    _id: { type: String, default: "singleton" },
    pinHash: { type: String, required: true },
    salt: { type: String, required: true },
  },
  { timestamps: true },
);

export const AdminAuth = models.AdminAuth || model("AdminAuth", adminAuthSchema);
