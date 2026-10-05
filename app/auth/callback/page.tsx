"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { completeAuth } from "@/lib/supabase/complete-auth";
export default function Page() {
  const [error, setError] = useState("");
  const completion = useRef<Promise<string> | null>(null);
  useEffect(() => {
    let active = true;
    // Reuse the same exchange during React Strict Mode: auth codes are single use.
    if (!completion.current) {
      const url = new URL(location.href);
      history.replaceState(null, "", "/auth/callback");
      completion.current = completeAuth(createClient(), url);
    }
    completion.current.then(next => { if (active) location.replace(next); }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Não foi possível confirmar o acesso."); });
    return () => { active = false; };
  }, []);
  return <main className="min-h-screen px-4 py-10"><div className="mx-auto max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6"><h1 className="text-2xl font-bold">{error ? "Confirmação de acesso" : "Concluindo seu acesso…"}</h1><p role={error ? "alert" : "status"} className="mt-4 text-slate-300">{error || "Estamos validando o link e preparando sua sessão."}</p>{error && <Link href="/auth/login" className="mt-5 block rounded-xl bg-violet-600 p-3 text-center font-bold">Entrar com e-mail e senha</Link>}</div></main>;
}
