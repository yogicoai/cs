import { notFound } from "next/navigation";
import { SelfGuide } from "@/components/SelfGuide";
import { getChannel } from "@/lib/repositories/channelRepository";
import { getPublishedFaqs } from "@/lib/repositories/faqRepository";
import { filterFaqsByChannel } from "@/lib/faqVisibility";

type GuidePageProps = {
  params: Promise<{
    channel: string;
  }>;
};

export default async function GuidePage({ params }: GuidePageProps) {
  const { channel } = await params;
  const [channelCopy, faqs] = await Promise.all([getChannel(channel), getPublishedFaqs()]);

  if (!channelCopy) {
    notFound();
  }

  return <SelfGuide channel={channel} channelCopy={channelCopy} faqs={filterFaqsByChannel(faqs, channel)} />;
}
