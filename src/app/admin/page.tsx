import { AdminFaqManager } from "@/components/AdminFaqManager";
import { EngagementDashboard } from "@/components/EngagementDashboard";
import { getAdminFaqs } from "@/lib/repositories/faqRepository";

export default async function AdminPage() {
  const faqs = await getAdminFaqs();

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
    </main>
  );
}
