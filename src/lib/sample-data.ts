import { channels, faqs } from "@/data/sample";

export type FaqItem = {
  id: string;
  category: string;
  subcategory?: string;
  question: string;
  answer: string;
  keywords: string[];
  status?: "draft" | "published" | "archived";
  updatedAt?: string;
};

export type ChannelItem = {
  slug: string;
  name: string;
  greeting: string;
  closingMessage: string;
  kakaoUrl: string;
  phoneNumber: string;
};

export function getSampleFaqs(): FaqItem[] {
  return faqs.map((faq) => ({
    ...faq,
    status: "published",
    updatedAt: new Date().toISOString(),
  }));
}

export function getSampleChannel(slug: string): ChannelItem | null {
  const channel = channels[slug as keyof typeof channels];

  if (!channel) {
    return null;
  }

  return {
    slug,
    ...channel,
  };
}
