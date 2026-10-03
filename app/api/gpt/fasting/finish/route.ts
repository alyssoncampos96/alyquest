import { NextResponse, type NextRequest } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { getBearerToken } from "@/lib/gpt-auth";

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("aq_gpt_finish_fast", {
    p_token: token,
    p_session_id: body.session_id ? String(body.session_id) : null,
    p_started_at: body.started_at ? String(body.started_at) : null,
    p_ended_at: body.ended_at ? String(body.ended_at) : null,
    p_notes: String(body.notes ?? "").slice(0, 1000),
  });
  if (error) return NextResponse.json({ error: error.code === "P0001" ? error.message : "Não foi possível finalizar o jejum." }, { status: error.code === "P0001" ? 400 : 500 });
  return NextResponse.json({ ok: true, ...data });
}
