import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      throw redirect({ to: "/board" });
    }
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      throw redirect({ to: "/board" });
    }
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
