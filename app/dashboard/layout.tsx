import { requirePageUser } from "@/lib/auth/dal";
import { canManageTeam } from "@/lib/auth/roles";
import { Header } from "@/components/common/Header";
import { NavLink } from "@/components/common/NavLink";
import { HistoryIcon, UsersIcon } from "@/components/common/icons";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { RoleProvider } from "@/components/auth/RoleProvider";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <Header
        nav={
          canManageTeam(user.role) && (
            <>
              <NavLink href="/dashboard/team">
                <UsersIcon className="h-4 w-4" />
                Team
              </NavLink>
              <NavLink href="/dashboard/audit">
                <HistoryIcon className="h-4 w-4" />
                Audit log
              </NavLink>
            </>
          )
        }
      >
        <ThemeToggle />
        <AccountMenu email={user.email} role={user.role} />
      </Header>
      <RoleProvider role={user.role}>
        <div className="flex flex-1 flex-col">{children}</div>
      </RoleProvider>
    </div>
  );
}
