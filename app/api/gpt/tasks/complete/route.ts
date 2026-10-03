import { NextResponse, type NextRequest } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { getBearerToken } from "@/lib/gpt-auth";

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const taskId = body?.task_id ? String(body.task_id) : null;
  const query = body?.query ? String(body.query) : null;
  if (!taskId && !query?.trim()) return NextResponse.json({ error: "Informe task_id ou query." }, { status: 400 });
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("aq_gpt_complete_task", {
    p_token: token,
    p_task_id: taskId,
    p_query: query,
  });
  if (error) return NextResponse.json({ error: error.code === "P0001" ? error.message : "Não foi possível concluir a missão." }, { status: error.code === "P0001" ? 400 : 500 });
  return NextResponse.json({ ok: true, ...data });
}
