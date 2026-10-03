import { NextResponse, type NextRequest } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { getBearerToken } from "@/lib/gpt-auth";

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !String(body.title ?? "").trim()) return NextResponse.json({ error: "Informe o título da missão." }, { status: 400 });
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("aq_gpt_create_task", {
    p_token: token,
    p_title: String(body.title).trim(),
    p_category: String(body.category ?? "Pessoal").trim() || "Pessoal",
    p_priority: String(body.priority ?? "medium"),
    p_estimated_hours: Number(body.estimated_hours ?? 1),
    p_due_date: body.due_date ? String(body.due_date) : null,
    p_notes: String(body.notes ?? "").slice(0, 1000),
  });
  if (error) return NextResponse.json({ error: error.code === "P0001" ? error.message : "Não foi possível criar a missão." }, { status: error.code === "P0001" ? 400 : 500 });
  return NextResponse.json({ ok: true, ...data });
}
