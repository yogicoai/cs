import { AdminLogin } from "@/components/AdminLogin";
import { isAuthed } from "@/lib/adminAuth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAuthed();
  if (!authed) {
    return <AdminLogin />;
  }
  return <>{children}</>;
}
