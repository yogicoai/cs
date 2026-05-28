import type { FaqItem } from "@/lib/sample-data";

export function isFaqVisibleForChannel(faq: Pick<FaqItem, "category">, channel: string) {
  if (faq.category === "홈페이지") {
    return channel === "ownmall";
  }

  return true;
}

export function filterFaqsByChannel<T extends Pick<FaqItem, "category">>(faqs: T[], channel: string) {
  return faqs.filter((faq) => isFaqVisibleForChannel(faq, channel));
}
