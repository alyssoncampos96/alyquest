"use client";
import { useRef, useState, startTransition, type ReactNode, type FormEvent } from "react";
export function ActionForm({ action, children, className, resetOnSuccess = false }: { action: (data: FormData) => Promise<void>; children: ReactNode; className?: string; resetOnSuccess?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    busy.current = true; setPending(true); setError("");
    startTransition(async () => {
    try { await action(data); if (resetOnSuccess) { form.reset(); form.closest("dialog")?.close(); } }
    catch { setError("Não foi possível salvar. Confira sua conexão, sessão e os dados informados e tente novamente."); }
    finally { busy.current = false; setPending(false); }
    });
  }
  return <form onSubmit={submit} className={className} aria-busy={pending}><fieldset disabled={pending} className="min-w-0 disabled:opacity-60">{children}</fieldset>{pending && <p role="status" className="mt-2 text-sm text-slate-400">Salvando...</p>}{error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}</form>;
}
