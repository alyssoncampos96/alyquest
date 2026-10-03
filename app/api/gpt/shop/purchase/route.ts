import { NextResponse, type NextRequest } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { getBearerToken } from "@/lib/gpt-auth";

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.item_id) return NextResponse.json({ error: "Informe item_id." }, { status: 400 });
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("aq_gpt_purchase_item", { p_token: token, p_item_id: String(body.item_id), p_equip: body.equip === true });
  if (error) return NextResponse.json({ error: error.code === "P0001" ? error.message : "Não foi possível comprar o item." }, { status: error.code === "P0001" ? 400 : 500 });
  return NextResponse.json({ ok: true, ...data });
}
