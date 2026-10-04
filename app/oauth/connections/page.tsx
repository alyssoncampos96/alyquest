import { Suspense } from "react";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
async function Content() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/auth/login?next=/oauth/connections");
  const { data, error } = await client.rpc("aq_mcp_connections");
  async function revoke(form: FormData) {
    "use server";
    const session = await createClient();
    const { error } = await session.rpc("aq_mcp_revoke", { p_session: String(form.get("session")) });
    if (error) throw new Error("Não foi possível desconectar.");
    revalidatePath("/oauth/connections");
  }
  const connections = (data ?? []) as { id: string; name: string; active: boolean }[];
  return <main className="min-h-screen px-4 py-10"><section className="mx-auto max-w-md"><Link href="/gpt" className="text-violet-400">← GPT</Link><h1 className="mt-4 text-2xl font-bold">Conexões com ChatGPT</h1>{error ? <p>Não foi possível consultar conexões.</p> : connections.length ? connections.map(connection => <article key={connection.id} className="mt-4 rounded-2xl border border-slate-700 p-4"><p>{connection.name} · {connection.active ? "Conectado" : "Desconectado"}</p>{connection.active && <form action={revoke}><input type="hidden" name="session" value={connection.id} /><button className="mt-3 rounded-xl border border-slate-600 px-4 py-2">Desconectar</button></form>}</article>) : <p className="mt-4">Nenhuma conexão ativa.</p>}</section></main>;
}
export default function Page() { return <Suspense fallback={<p>Carregando conexões…</p>}><Content /></Suspense>; }
