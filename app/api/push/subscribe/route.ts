import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PushBody = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

function invalid(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return invalid("Faça login para ativar notificações.", 401);

  const body = await request.json().catch(() => null) as PushBody | null;
  const endpoint = body?.endpoint?.trim();
  const p256dh = body?.keys?.p256dh?.trim();
  const auth = body?.keys?.auth?.trim();

  if (!endpoint || !p256dh || !auth) return invalid("Inscrição push inválida.");

  const { error } = await supabase.from("aq_push_subscriptions").upsert({
    user_id: user.id,
    endpoint,
    p256dh,
    auth,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    revoked_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });

  if (error) return invalid(error.message, 500);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return invalid("Faça login para alterar notificações.", 401);

  const body = await request.json().catch(() => null) as { endpoint?: string } | null;
  const endpoint = body?.endpoint?.trim();
  if (!endpoint) return invalid("Inscrição push indisponível.");

  const { error } = await supabase
    .from("aq_push_subscriptions")
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) return invalid(error.message, 500);
  return NextResponse.json({ ok: true });
}
