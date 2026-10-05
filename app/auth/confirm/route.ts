import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/supabase/redirect";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const token_hash = params.get("token_hash");
  const type = params.get("type");
  if (token_hash && type && ["signup", "invite", "magiclink", "recovery", "email_change", "email"].includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as EmailOtpType });
    if (!error) return NextResponse.redirect(new URL(safeNext(params.get("next") || (type === "recovery" ? "/auth/update-password" : "/")), request.url));
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return NextResponse.redirect(new URL(safeNext(params.get("next") || (type === "recovery" ? "/auth/update-password" : "/")), request.url));
  return NextResponse.redirect(new URL("/auth/error", request.url));
}
