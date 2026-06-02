import { notFound } from "next/navigation";
import { SelfGuide } from "@/components/SelfGuide";
import { getChannel } from "@/lib/repositories/channelRepository";
import { getLiveClaimsAsFaqs } from "@/lib/repositories/claimRepository";
import { getPublishedFaqs } from "@/lib/repositories/faqRepository";
import { filterFaqsByChannel } from "@/lib/faqVisibility";

type GuidePageProps = {
  params: Promise<{
    channel: string;
  }>;
};

export default async function GuidePage({ params }: GuidePageProps) {
  const { channel } = await params;
  const [channelCopy, faqs, claimFaqs] = await Promise.all([
    getChannel(channel),
    getPublishedFaqs(),
    getLiveClaimsAsFaqs(),
  ]);

  if (!channelCopy) {
    notFound();
  }

  // 라이브 클레임을 일반 FAQ 형태로 합쳐 노출하되, 출처(고객 클레임) 라벨은 표시하지 않는다.
  const merged = [...faqs, ...claimFaqs];

  return <SelfGuide channel={channel} channelCopy={channelCopy} faqs={filterFaqsByChannel(merged, channel)} />;
}
