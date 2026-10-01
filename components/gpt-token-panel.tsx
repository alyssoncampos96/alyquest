"use client";

import { useState, useTransition } from "react";
import { createGptToken } from "@/app/integration-actions";

export function GptTokenPanel({ openApiUrl }: { openApiUrl: string }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Acesso do GPT</h2>
          <p className="mt-1 text-xs text-slate-400">Use este token como Bearer Token no GPT personalizado.</p>
        </div>
        <button
          disabled={pending}
          onClick={() => startTransition(async () => {
            setError("");
            try {
              const result = await createGptToken();
              setToken(result.token);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Não foi possível gerar.");
            }
          })}
          className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold disabled:opacity-60"
        >
          {pending ? "Gerando..." : "Gerar"}
        </button>
      </div>
      <label className="mt-4 block text-xs text-slate-400">
        Schema
        <input readOnly value={openApiUrl} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-200" />
      </label>
      {token && (
        <label className="mt-3 block text-xs text-amber-200">
          Token novo
          <textarea readOnly value={token} className="mt-2 h-24 w-full rounded-xl border border-amber-700 bg-slate-950 p-3 text-xs text-amber-100" />
        </label>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    </section>
  );
}
