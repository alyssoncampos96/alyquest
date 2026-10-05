"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export function SessionSync({ userId }: { userId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/auth/callback") return;
    const s = createClient();
    let active = true;
    let checking = false;
    async function check() {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const { data: { session }, error: sessionError } = await s.auth.getSession();
        if (sessionError) return;
        const { data: { user }, error } = session ? await s.auth.getUser() : { data: { user: null }, error: null };
        if (!active || error || (user?.id ?? null) === userId) return;
        if (user && ["/auth/login", "/auth/sign-up", "/auth/sign-up-success"].includes(pathname)) {
          location.replace("/");
        } else router.refresh();
      } catch {
        // A transient network failure should not sign the user out.
      } finally { checking = false; }
    }
    const { data: { subscription } } = s.auth.onAuthStateChange(() => { setTimeout(() => { if (active) void check(); }, 0); });
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => { active = false; subscription.unsubscribe(); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, [router, pathname, userId]);
  return null;
}
