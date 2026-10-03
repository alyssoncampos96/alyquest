import { NextResponse, type NextRequest } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { getBearerToken } from "@/lib/gpt-auth";

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const amount = Number(body?.amount);
  if (!body?.title || !Number.isFinite(amount) || amount <= 0 || !body.start_on) return NextResponse.json({ error: "Confira título, valor e começo." }, { status: 400 });
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("aq_gpt_save_finance_recurring", {
    p_token: token,
    p_title: String(body.title),
    p_amount: amount,
    p_kind: String(body.kind ?? "expense"),
    p_category: String(body.category ?? "Outros"),
    p_start_on: String(body.start_on),
    p_frequency: String(body.frequency ?? "monthly"),
    p_payment_method: String(body.payment_method ?? "pix"),
    p_notes: String(body.notes ?? "").slice(0, 1000),
  });
  if (error) return NextResponse.json({ error: error.code === "P0001" ? error.message : "Não foi possível criar a recorrência." }, { status: error.code === "P0001" ? 400 : 500 });
  return NextResponse.json({ ok: true, ...data });
}
