import { createHash, randomBytes } from "node:crypto";
import { createAnonClient } from "@/lib/supabase/anon";
import { MCP_RESOURCE, MCP_SCOPE, allowedOAuthRedirect } from "@/lib/mcp-oauth";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", Pragma: "no-cache" };
  const invalid = (error: string, status = 400) => Response.json({ error }, { status, headers });
  if (!request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) return invalid("invalid_request");
  const body = new URLSearchParams(await request.text());
  const grant = body.get("grant_type");
  if (grant !== "authorization_code" && grant !== "refresh_token") return invalid("unsupported_grant_type");
  const client = body.get("client_id") ?? "";
  const credential = body.get(grant === "authorization_code" ? "code" : "refresh_token") ?? "";
  const verifier = body.get("code_verifier") ?? "";
  const redirectUri = body.get("redirect_uri") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(client) || credential.length < 32 || credential.length > 512 || body.get("resource") !== MCP_RESOURCE || (body.has("scope") && body.get("scope") !== MCP_SCOPE)) return invalid("invalid_request");
  if (grant === "authorization_code" && (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || !allowedOAuthRedirect(redirectUri))) return invalid("invalid_grant");
  const access = `aq_oauth_${randomBytes(32).toString("base64url")}`;
  const refresh = randomBytes(32).toString("base64url");
  const { error } = await createAnonClient().rpc("aq_mcp_exchange", { p_grant: grant, p_client: client, p_secret: body.get("client_secret"), p_credential: credential, p_redirect: redirectUri, p_challenge: createHash("sha256").update(verifier).digest("base64url"), p_access: access, p_refresh: refresh, p_resource: MCP_RESOURCE });
  if (error) return invalid(error.code === "P0001" ? (error.message === "invalid_client" ? "invalid_client" : "invalid_grant") : "temporarily_unavailable", error.code === "P0001" ? 400 : 503);
  return Response.json({ access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: 3600, scope: MCP_SCOPE }, { headers });
}
