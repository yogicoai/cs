import { connectDB } from "@/lib/db";
import { getSampleChannel, type ChannelItem } from "@/lib/sample-data";
import { Channel } from "@/models/Channel";

export async function getChannel(slug: string): Promise<ChannelItem | null> {
  try {
    await connectDB();
    const channel = await Channel.findOne({ slug, isActive: true }).lean();

    if (!channel) {
      return getSampleChannel(slug);
    }

    return {
      slug: channel.slug,
      name: channel.name,
      greeting: channel.greeting,
      closingMessage: channel.closingMessage,
      kakaoUrl: channel.kakaoUrl,
      phoneNumber: channel.phoneNumber,
    };
  } catch {
    return getSampleChannel(slug);
  }
}
