import { NextResponse, type NextRequest } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { getBearerToken } from "@/lib/gpt-auth";

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 401 });
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("aq_gpt_fasting_status", { p_token: token });
  if (error) return NextResponse.json({ error: error.code === "P0001" ? error.message : "Não foi possível consultar o jejum." }, { status: error.code === "P0001" ? 400 : 500 });
  return NextResponse.json({ ok: true, ...data });
}
