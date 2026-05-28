import { model, models, Schema } from "mongoose";

const eventLogSchema = new Schema(
  {
    channel: { type: String, required: true, index: true },
    sessionId: { type: String, default: "", index: true },
    eventType: {
      type: String,
      enum: [
        "visit",
        "category_view",
        "subcategory_view",
        "question_view",
        "feedback_positive",
        "feedback_negative",
        "ai_query",
        "no_result",
        "contact_click",
        "resolved",
      ],
      required: true,
      index: true,
    },
    category: { type: String, default: "" },
    faqId: { type: Schema.Types.ObjectId, ref: "Faq" },
    query: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export const EventLog = models.EventLog || model("EventLog", eventLogSchema);
