import { NextResponse, type NextRequest } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { getBearerToken } from "@/lib/gpt-auth";

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.task_id || !body.action) return NextResponse.json({ error: "Informe task_id e action." }, { status: 400 });
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("aq_gpt_task_state", {
    p_token: token,
    p_task_id: String(body.task_id),
    p_action: String(body.action),
    p_date: body.date ? String(body.date) : null,
  });
  if (error) return NextResponse.json({ error: error.code === "P0001" ? error.message : "Não foi possível atualizar a missão." }, { status: error.code === "P0001" ? 400 : 500 });
  return NextResponse.json({ ok: true, ...data });
}
