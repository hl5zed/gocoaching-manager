import type { ReactNode } from "react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { ADMIN_NAV } from "@/components/layout/adminNav";
import { CoachShellActions } from "@/components/layout/CoachShellActions";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ShellLayout
      homeHref="/admin"
      navSections={ADMIN_NAV}
      topbarActions={<CoachShellActions />}
    >
      {children}
    </ShellLayout>
  );
}
