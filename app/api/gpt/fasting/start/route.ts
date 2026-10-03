import { NextResponse, type NextRequest } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { getBearerToken } from "@/lib/gpt-auth";

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("aq_gpt_start_fast", {
    p_token: token,
    p_started_at: body.started_at ? String(body.started_at) : null,
    p_notes: String(body.notes ?? "").slice(0, 1000),
  });
  if (error) return NextResponse.json({ error: error.code === "P0001" ? error.message : "Não foi possível iniciar o jejum." }, { status: error.code === "P0001" ? 400 : 500 });
  return NextResponse.json({ ok: true, ...data });
}
