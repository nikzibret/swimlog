import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_tabs/")({
  beforeLoad: () => {
    throw redirect({ to: "/calendar" });
  },
});
