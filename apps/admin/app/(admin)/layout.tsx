import { AdminShell } from "../../src/components/admin-shell";
import { AdminAuthGuard } from "../../src/components/admin-auth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthGuard><AdminShell>{children}</AdminShell></AdminAuthGuard>;
}
