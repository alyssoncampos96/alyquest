import { randomBytes } from "node:crypto";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { MCP_ORIGIN, parseOAuthRequest } from "@/lib/mcp-oauth";

type Params = Record<string, string | string[] | undefined>;
async function Content({ searchParams }: { searchParams: Promise<Params> }) {
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (typeof value === "string") params.set(key, value);
  const oauth = parseOAuthRequest(params);
  if (!oauth) return <p className="p-8">Pedido de conexão inválido. Inicie a conexão novamente pelo ChatGPT.</p>;
  const { data: client, error } = await createAnonClient().rpc("aq_mcp_client", { p_client: oauth.clientId, p_redirect: oauth.redirectUri });
  if (error || !client) return <p className="p-8">Conexão não reconhecida. Volte ao ChatGPT e tente novamente.</p>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/oauth/authorize?${params}`)}`);

  async function decide(form: FormData) {
    "use server";
    if (!oauth) return;
    const session = await createClient();
    const { data: { user: current } } = await session.auth.getUser();
    if (!current || current.id !== user?.id) throw new Error("Entre novamente para conectar.");
    const callback = new URL(oauth.redirectUri);
    callback.searchParams.set("state", oauth.state);
    callback.searchParams.set("iss", MCP_ORIGIN);
    if (form.get("decision") === "approve") {
      const code = randomBytes(32).toString("base64url");
      const { error } = await session.rpc("aq_mcp_authorize", { p_client: oauth.clientId, p_redirect: oauth.redirectUri, p_challenge: oauth.challenge, p_code: code });
      if (error) throw new Error("Não foi possível conectar. Tente novamente.");
      callback.searchParams.set("code", code);
    } else callback.searchParams.set("error", "access_denied");
    redirect(callback.toString());
  }
  return <main className="min-h-screen px-4 py-10"><section className="mx-auto max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6"><h1 className="text-2xl font-bold">Conectar AlyQuest ao ChatGPT</h1><p className="mt-4">Conta: {user.email}</p><p className="mt-3">O aplicativo {String(client.name)} poderá consultar e alterar suas tarefas, finanças, jejuns e itens da loja, conforme seus pedidos no ChatGPT.</p><p className="mt-3 text-sm text-slate-400">Sua senha não será compartilhada. Você poderá desconectar em “Conexões com ChatGPT” no AlyQuest.</p><form action={decide} className="mt-6 flex gap-3"><button name="decision" value="approve" className="rounded-xl bg-violet-600 px-4 py-3 font-bold">Conectar minha conta</button><button name="decision" value="deny" className="rounded-xl border border-slate-600 px-4 py-3">Cancelar</button></form></section></main>;
}
export default function Page(props: { searchParams: Promise<Params> }) { return <Suspense fallback={<p className="p-8">Preparando conexão…</p>}><Content {...props} /></Suspense>; }
