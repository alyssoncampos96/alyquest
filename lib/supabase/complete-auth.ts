import type { SupabaseClient, EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "./redirect";
const emailTypes = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];
export async function completeAuth(s: SupabaseClient, url: URL): Promise<string> {
  const query = url.searchParams;
  const fragment = new URLSearchParams(url.hash.slice(1));
  const type = query.get("type") || fragment.get("type");
  const next = safeNext(type === "recovery" ? "/auth/update-password" : query.get("next"));
  if (query.has("error") || fragment.has("error")) throw new Error("Este link expirou ou não é válido. Solicite um novo e-mail de confirmação.");
  let error: { message: string; code?: string } | null = null;
  if (query.get("token_hash") && type && emailTypes.includes(type)) {
    ({ error } = await s.auth.verifyOtp({ token_hash: query.get("token_hash")!, type: type as EmailOtpType }));
  } else if (query.get("code")) {
    ({ error } = await s.auth.exchangeCodeForSession(query.get("code")!));
  } else if (fragment.get("access_token") && fragment.get("refresh_token")) {
    ({ error } = await s.auth.setSession({ access_token: fragment.get("access_token")!, refresh_token: fragment.get("refresh_token")! }));
  }
  const { data: { user }, error: userError } = await s.auth.getUser();
  if (user && !userError) return next;
  if (error?.code === "flow_state_not_found" || error?.code === "bad_code_verifier" || error?.code === "pkce_code_verifier_not_found" || error?.code === "pkce_verifier_invalid") {
    return "/auth/login?confirmation=other-browser";
  }
  throw new Error("Não foi possível concluir o acesso. Abra o link no navegador usado no cadastro ou entre com seu e-mail e senha. Se necessário, solicite um novo link.");
}
