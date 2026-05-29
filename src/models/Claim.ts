import { model, models, Schema } from "mongoose";

// 고객 클레임/문의 이력 큐레이션:
// 업로드(고객문의 + CS답변) → AI가 카테고리·추천답변 생성("AI 답변 들어보기")
// → CS가 더블체크 후 최종답변 확정 → status=live 로 전환해야 AI 응대에 사용됨.
// 어떤 경우에도 고객 탐색(카테고리/질문 목록)에는 노출되지 않는다.
const claimSchema = new Schema(
  {
    category: { type: String, default: "", index: true },
    situation: { type: String, required: true },
    keywords: [{ type: String }],
    csAnswer: { type: String, default: "" },
    aiSuggestedAnswer: { type: String, default: "" },
    answer: { type: String, default: "" },
    status: { type: String, enum: ["review", "live", "hold"], default: "review", index: true },
    note: { type: String, default: "" },
    source: { type: String, default: "manual" },
  },
  { timestamps: true },
);

claimSchema.index({ situation: "text", keywords: "text", answer: "text" });

export const Claim = models.Claim || model("Claim", claimSchema);
