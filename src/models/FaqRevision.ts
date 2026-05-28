import { model, models, Schema } from "mongoose";

const faqRevisionSchema = new Schema(
  {
    faqId: { type: Schema.Types.ObjectId, ref: "Faq", required: true, index: true },
    before: { type: Schema.Types.Mixed, required: true },
    after: { type: Schema.Types.Mixed, required: true },
    changedBy: { type: String, required: true },
    changeReason: { type: String, default: "" },
  },
  { timestamps: true },
);

export const FaqRevision = models.FaqRevision || model("FaqRevision", faqRevisionSchema);
