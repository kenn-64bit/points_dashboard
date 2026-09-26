import { requirePageUser } from "@/lib/auth/dal";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();

  return (
    <div className="relative">
      <div className="absolute right-4 top-4 z-30 flex items-center gap-1 rounded-full border border-border bg-surface py-1 pl-3.5 pr-1 shadow-sm sm:right-6">
        <span className="hidden max-w-48 truncate text-xs text-muted-foreground sm:inline">{user.email}</span>
        <SignOutButton />
      </div>
      {children}
    </div>
  );
}
