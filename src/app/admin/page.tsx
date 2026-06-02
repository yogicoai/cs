import Link from "next/link";
import { BookOpen } from "lucide-react";
import { AdminFaqManager } from "@/components/AdminFaqManager";
import { ClaimManager } from "@/components/ClaimManager";
import { EngagementDashboard } from "@/components/EngagementDashboard";
import { getAllClaims } from "@/lib/repositories/claimRepository";
import { getAdminFaqs } from "@/lib/repositories/faqRepository";

export default async function AdminPage() {
  const [faqs, claims] = await Promise.all([getAdminFaqs(), getAllClaims()]);
  const liveClaims = claims.filter((claim) => claim.status === "live" && claim.answer);

  return (
    <main className="admin-shell">
      <section className="admin-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>상담 지표 운영관리</h1>
        </div>
        <Link href="/admin/guide" className="guide-link">
          <BookOpen size={16} />
          사용 가이드
        </Link>
      </section>

      <EngagementDashboard faqCount={faqs.length} />

      <AdminFaqManager initialFaqs={faqs} initialLiveClaims={liveClaims} />

      <ClaimManager initialClaims={claims} />
    </main>
  );
}
