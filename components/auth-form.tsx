"use client";
import { cleanName } from "@/lib/user-preferences";
import { safeNext } from "@/lib/supabase/redirect";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
type Mode = "login" | "sign-up" | "forgot-password" | "update-password";
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (mode === "login" && new URLSearchParams(location.search).get("confirmation") === "other-browser") setMessage("O link foi aberto em outro navegador. Entre com seu e-mail e senha para continuar.");
  }, [mode]);
  const title = { login: "Entrar", "sign-up": "Criar conta", "forgot-password": "Recuperar senha", "update-password": "Nova senha" }[mode];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "");
    const password = String(data.get("password") || "");
    if (mode === "sign-up" && password !== String(data.get("confirm_password") || "")) { setMessage("As senhas não conferem."); setPending(false); return; }
    try {
      const supabase = createClient();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        location.replace(safeNext(new URLSearchParams(location.search).get("next")));
      } else if (mode === "sign-up") {
        const { data: signup, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: cleanName(data.get("display_name")) }, emailRedirectTo: `${location.origin}/auth/callback` } });
        if (error) throw error;
        location.replace(signup.session ? "/" : "/auth/sign-up-success");
      } else if (mode === "forgot-password") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/auth/update-password` });
        if (error) throw error;
        setMessage("Confira seu e-mail para redefinir a senha.");
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        router.replace("/"); router.refresh();
      }
    } catch { setMessage("Não foi possível concluir. Confira os dados e tente novamente."); }
    finally { setPending(false); }
  }
  return <main className="min-h-screen px-4 py-10 pb-28"><div className="mx-auto max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6"><Link href="/" className="text-violet-400">⚔️ AlyQuest</Link><h1 className="mt-4 text-2xl font-bold">{title}</h1><form onSubmit={submit} className="mt-6 space-y-4">{mode === "sign-up" && <label className="block">Como você quer ser chamado?<input className="mt-2 w-full rounded-xl bg-slate-950 p-3" name="display_name" autoComplete="nickname" maxLength={80} required /></label>}{mode !== "update-password" && <label className="block">E-mail<input className="mt-2 w-full rounded-xl bg-slate-950 p-3" name="email" type="email" autoComplete="email" required /></label>}{mode !== "forgot-password" && <label className="block">Senha<input className="mt-2 w-full rounded-xl bg-slate-950 p-3" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? undefined : 6} required /></label>}{mode === "sign-up" && <label className="block">Confirme a senha<input className="mt-2 w-full rounded-xl bg-slate-950 p-3" name="confirm_password" type="password" autoComplete="new-password" minLength={6} required /></label>}{message && <p role="status" className="text-amber-300">{message}</p>}<button disabled={pending} className="w-full rounded-xl bg-violet-600 p-3 font-bold disabled:opacity-50">{pending ? "Aguarde..." : title}</button></form><div className="mt-5 space-y-3 text-sm">{mode === "login" && <Link href="/auth/sign-up" className="block rounded-xl border border-violet-500 p-3 text-center font-bold text-violet-200">Novo no AlyQuest? Criar minha conta</Link>}<div className="flex flex-wrap gap-4 text-violet-300"><Link href="/auth/login">Entrar</Link><Link href="/auth/forgot-password">Esqueci a senha</Link></div>{mode === "sign-up" && <p className="text-xs text-slate-400">Se a confirmação por e-mail estiver ativada, enviaremos um link para validar sua conta.</p>}</div></div></main>;
}
