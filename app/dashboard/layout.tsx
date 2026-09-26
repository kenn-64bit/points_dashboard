import { requirePageUser } from "@/lib/auth/dal";
import { Header } from "@/components/common/Header";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <Header>
        <span className="hidden max-w-48 truncate px-1 text-xs text-muted-foreground sm:inline">{user.email}</span>
        <ThemeToggle />
        <SignOutButton />
      </Header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
