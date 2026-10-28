import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BottomTabs } from "@/components/swim/BottomTabs";
import { Toaster } from "sonner";

export const Route = createFileRoute("/_tabs")({
  component: TabsLayout,
});

function TabsLayout() {
  return (
    <div className="min-h-dvh bg-surface">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white shadow-[0_0_0_1px_var(--border)]">
        <main className="flex flex-1 flex-col pb-[calc(64px+env(safe-area-inset-bottom))]">
          <Outlet />
        </main>
        <BottomTabs />
      </div>
      <Toaster position="top-center" richColors />
    </div>
  );
}
