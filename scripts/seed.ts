import mongoose from "mongoose";
import { channels, faqs } from "../src/data/sample";

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is required. Create .env.local or pass it before running seed.");
  process.exit(1);
}

const channelSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    greeting: { type: String, required: true },
    closingMessage: { type: String, required: true },
    kakaoUrl: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const faqSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    subcategory: { type: String, default: "" },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    keywords: [{ type: String }],
    channelVisibility: [{ type: String }],
    status: { type: String, default: "published" },
    revision: { type: Number, default: 1 },
    updatedBy: { type: String, default: "seed" },
  },
  { timestamps: true },
);

const Channel = mongoose.models.Channel || mongoose.model("Channel", channelSchema);
const Faq = mongoose.models.Faq || mongoose.model("Faq", faqSchema);

async function seed() {
  await mongoose.connect(uri as string);

  await Promise.all(
    Object.entries(channels).map(([slug, channel]) =>
      Channel.updateOne({ slug }, { $set: { slug, ...channel, isActive: true } }, { upsert: true }),
    ),
  );

  await Promise.all(
    faqs.map((faq) =>
      Faq.updateOne(
        { question: faq.question },
        {
          $set: {
            category: faq.category,
            subcategory: "subcategory" in faq ? faq.subcategory : "",
            question: faq.question,
            answer: faq.answer,
            keywords: faq.keywords,
            status: "published",
            updatedBy: "seed",
          },
        },
        { upsert: true },
      ),
    ),
  );

  console.log(`Seeded ${Object.keys(channels).length} channels and ${faqs.length} FAQs.`);
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
