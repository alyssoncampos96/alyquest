import { NextResponse, type NextRequest } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";

function getToken(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const [type, token] = header.split(/\s+/);
  return type?.toLowerCase() === "bearer" ? token : "";
}

export async function POST(request: NextRequest) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const amount = Number(body.amount);
  const occurred = String(body.occurred_on ?? "");
  if (!String(body.title ?? "").trim() || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(occurred)) {
    return NextResponse.json({ error: "Confira descrição, valor e data." }, { status: 400 });
  }
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("aq_gpt_add_finance_transaction", {
    p_token: token,
    p_title: String(body.title).trim(),
    p_amount: amount,
    p_kind: "expense",
    p_category: String(body.category ?? "Outros").trim() || "Outros",
    p_occurred_on: occurred,
    p_payment_method: String(body.payment_method ?? "other"),
    p_installments: Number(body.installments ?? 1),
    p_notes: String(body.notes ?? "").slice(0, 1000),
  });
  if (error) {
    return NextResponse.json({ error: error.code === "P0001" ? error.message : "Não foi possível registrar." }, { status: error.code === "P0001" ? 400 : 500 });
  }
  return NextResponse.json({ ok: true, ...data });
}
