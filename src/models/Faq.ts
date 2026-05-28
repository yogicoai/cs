import { model, models, Schema } from "mongoose";

const faqSchema = new Schema(
  {
    category: { type: String, required: true, index: true },
    subcategory: { type: String, default: "", index: true },
    question: { type: String, required: true, index: true },
    answer: { type: String, required: true },
    keywords: [{ type: String }],
    channelVisibility: [{ type: String }],
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
      index: true,
    },
    revision: { type: Number, default: 1 },
    updatedBy: { type: String, default: "system" },
  },
  { timestamps: true },
);

faqSchema.index({ question: "text", answer: "text", keywords: "text" });

export const Faq = models.Faq || model("Faq", faqSchema);
