import { headers } from "next/headers";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GptTokenPanel } from "@/components/gpt-token-panel";

async function Content() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const host = (await headers()).get("host") ?? "alyquestv3.vercel.app";
  const protocol = host.includes("localhost") ? "http" : "https";
  const openApiUrl = `${protocol}://${host}/api/gpt/openapi`;
  const tokens = await supabase.from("aq_integration_tokens").select("id,name,last4,active,last_used_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-black">GPT</h1>
        <p className="mt-1 text-sm text-slate-400">Conecte uma conversa do ChatGPT ao AlyQuest.</p>
        <div className="mt-5"><GptTokenPanel openApiUrl={openApiUrl} /></div>
        <section className="mt-5 rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-bold">Configuração</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
            <li>Crie um GPT personalizado no ChatGPT.</li>
            <li>Adicione uma ação com o schema acima.</li>
            <li>Configure autenticação Bearer e cole o token gerado aqui.</li>
            <li>Peça algo como: registrar almoço de 45 reais hoje.</li>
          </ol>
        </section>
        <section className="mt-5 space-y-2">
          <h2 className="font-bold">Tokens</h2>
          {tokens.error && <p className="rounded-2xl border border-amber-700 bg-amber-950/40 p-4 text-sm text-amber-100">A migração de integrações ainda precisa ser aplicada.</p>}
          {(tokens.data ?? []).map(t => <article key={t.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-3"><h3 className="font-semibold">{t.name}</h3><p className="mt-1 text-xs text-slate-400">Final {t.last4} · {t.active ? "ativo" : "pausado"}{t.last_used_at ? ` · usado em ${new Date(t.last_used_at).toLocaleString("pt-BR")}` : ""}</p></article>)}
        </section>
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={<main className="p-6">Carregando GPT...</main>}><Content /></Suspense>;
}
