import { NextResponse, type NextRequest } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { getBearerToken } from "@/lib/gpt-auth";

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("aq_gpt_finance_summary", {
    p_token: token,
    p_month: body.month ? String(body.month) : null,
    p_category: body.category ? String(body.category) : null,
  });
  if (error) return NextResponse.json({ error: error.code === "P0001" ? error.message : "Não foi possível consultar o resumo." }, { status: error.code === "P0001" ? 400 : 500 });
  return NextResponse.json({ ok: true, ...data });
}
