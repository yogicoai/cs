import { model, models, Schema } from "mongoose";

const channelSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    greeting: { type: String, required: true },
    closingMessage: { type: String, required: true },
    kakaoUrl: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Channel = models.Channel || model("Channel", channelSchema);
