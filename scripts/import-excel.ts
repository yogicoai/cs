import mongoose from "mongoose";
import { readSheet } from "read-excel-file/node";
import { existsSync, readFileSync } from "node:fs";
import { Channel } from "../src/models/Channel";
import { Faq } from "../src/models/Faq";
import { inferFaqSubcategory } from "../src/lib/faqGrouping";

const DEFAULT_EXCEL_PATH = "file/chat.xlsx";
const DEFAULT_KAKAO_URL = "https://pf.kakao.com/";
const DEFAULT_PHONE_NUMBER = "02-557-0920";
const DEFAULT_CHANNEL_SLUGS = ["chat", "ownmall", "marketplace", "29cm"];

type CellValue = string | number | boolean | Date | null | undefined;

type TemplateRow = {
  templateName: string;
  fieldName: string;
  content: string;
};

type FaqRow = {
  category: string;
  subcategory: string;
  question: string;
  answer: string;
  keywords: string[];
};

type ChannelDraft = {
  slug: string;
  name: string;
  greeting: string;
  closingMessage: string;
  kakaoUrl: string;
  phoneNumber: string;
  isActive: boolean;
};

function loadEnvFiles() {
  for (const fileName of [".env", ".env.local"]) {
    if (!existsSync(fileName)) {
      continue;
    }

    const lines = readFileSync(fileName, "utf8").split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

      if (key) {
        process.env[key] = value;
      }
    }
  }
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function splitKeywords(value: unknown) {
  return cleanText(value)
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function fallbackSlug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "channel"
  );
}

function normalizeTemplateName(templateName: string) {
  return cleanText(templateName).replace(/\n+/g, " / ");
}

function parseTemplateRows(rows: CellValue[][]): TemplateRow[] {
  return rows.slice(1).map((row) => ({
    templateName: cleanText(row[0]),
    fieldName: cleanText(row[1]),
    content: cleanText(row[2]),
  }));
}

function parseFaqRows(rows: CellValue[][]): FaqRow[] {
  return rows
    .slice(1)
    .map((row) => {
      const hasSubcategoryColumn = row.length >= 5;
      const category = cleanText(row[0]);
      const subcategory = hasSubcategoryColumn ? cleanText(row[1]) : "";
      const question = cleanText(row[hasSubcategoryColumn ? 2 : 1]);
      const answer = cleanText(row[hasSubcategoryColumn ? 3 : 2]);
      const keywords = splitKeywords(row[hasSubcategoryColumn ? 4 : 3]);

      return {
        category,
        subcategory: subcategory || inferFaqSubcategory(category, question, keywords),
        question,
        answer,
        keywords,
      };
    })
    .filter((faq) => faq.category && faq.question && faq.answer);
}

function parseChannels(rows: TemplateRow[]) {
  const channels = new Map<string, ChannelDraft>();
  let currentTemplate = "";
  let currentSlug = "";
  let groupIndex = -1;

  for (const row of rows) {
    if (row.templateName) {
      groupIndex += 1;
      currentTemplate = row.templateName;
      currentSlug = DEFAULT_CHANNEL_SLUGS[groupIndex] ?? fallbackSlug(row.templateName);
    }

    if (!currentTemplate || !currentSlug || !row.content) {
      continue;
    }

    const existing = channels.get(currentSlug) ?? {
      slug: currentSlug,
      name: normalizeTemplateName(currentTemplate),
      greeting: "",
      closingMessage: "",
      kakaoUrl: DEFAULT_KAKAO_URL,
      phoneNumber: DEFAULT_PHONE_NUMBER,
      isActive: true,
    };

    if (!existing.greeting) {
      existing.greeting = row.content;
    } else {
      existing.closingMessage = row.content;
    }

    const phoneMatch = row.content.match(/\d{2,4}-\d{3,4}-\d{4}/);
    if (phoneMatch) {
      existing.phoneNumber = phoneMatch[0];
    }

    channels.set(currentSlug, existing);
  }

  return Array.from(channels.values()).filter((channel) => channel.greeting || channel.closingMessage);
}

async function readSheetRows(excelPath: string, sheet: number) {
  return (await readSheet(excelPath, sheet)) as CellValue[][];
}

async function main() {
  loadEnvFiles();

  const uri = process.env.MONGODB_URI;
  const excelPath = process.argv[2] ?? DEFAULT_EXCEL_PATH;
  const isDryRun = process.argv.includes("--dry-run");

  if (!uri && !isDryRun) {
    console.error("MONGODB_URI is required. Use --dry-run to validate the Excel file without importing.");
    process.exit(1);
  }

  const [templateSheetRows, faqSheetRows] = await Promise.all([
    readSheetRows(excelPath, 1),
    readSheetRows(excelPath, 2),
  ]);

  const channels = parseChannels(parseTemplateRows(templateSheetRows));
  const faqs = parseFaqRows(faqSheetRows);
  const duplicateQuestions = [...new Set(faqs.map((faq) => faq.question))].filter(
    (question) => faqs.filter((faq) => faq.question === question).length > 1,
  );

  console.log(`Excel: ${excelPath}`);
  console.log(`Channels: ${channels.length}`);
  console.log(`FAQs: ${faqs.length}`);
  console.log(`Duplicate questions: ${duplicateQuestions.length}`);

  if (duplicateQuestions.length > 0) {
    console.log("Duplicate question samples:");
    console.log(duplicateQuestions.slice(0, 10));
  }

  if (isDryRun) {
    console.log("Dry run complete. Nothing was imported.");
    return;
  }

  await mongoose.connect(uri as string);

  await Promise.all(
    channels.map((channel) =>
      Channel.updateOne({ slug: channel.slug }, { $set: channel }, { upsert: true }),
    ),
  );

  await Promise.all(
    faqs.map((faq) =>
      Faq.updateOne(
        { question: faq.question },
        {
          $set: {
            category: faq.category,
            subcategory: faq.subcategory,
            question: faq.question,
            answer: faq.answer,
            keywords: faq.keywords,
            channelVisibility: [],
            status: "published",
            updatedBy: "excel-import",
          },
          $setOnInsert: {
            revision: 1,
          },
        },
        { upsert: true },
      ),
    ),
  );

  console.log(`Imported ${channels.length} channels and ${faqs.length} FAQs.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
