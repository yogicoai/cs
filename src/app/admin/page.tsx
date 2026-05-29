import { AdminFaqManager } from "@/components/AdminFaqManager";
import { ClaimManager } from "@/components/ClaimManager";
import { EngagementDashboard } from "@/components/EngagementDashboard";
import { getAllClaims } from "@/lib/repositories/claimRepository";
import { getAdminFaqs } from "@/lib/repositories/faqRepository";

export default async function AdminPage() {
  const [faqs, claims] = await Promise.all([getAdminFaqs(), getAllClaims()]);

  return (
    <main className="admin-shell">
      <section className="admin-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>상담 지표 운영관리</h1>
        </div>
      </section>

      <EngagementDashboard faqCount={faqs.length} />

      <AdminFaqManager initialFaqs={faqs} />

      <ClaimManager initialClaims={claims} />
    </main>
  );
}
