import { Link, useRouterState } from "@tanstack/react-router";
import { Waves, CalendarDays, LineChart, User } from "lucide-react";

const tabs = [
  { to: "/calendar", label: "Calendar", Icon: CalendarDays },
  { to: "/log", label: "Log", Icon: Waves },
  { to: "/dashboard", label: "Dashboard", Icon: LineChart },
  { to: "/personal", label: "Personal", Icon: User },
] as const;


export function BottomTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-border bg-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {tabs.map(({ to, label, Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
