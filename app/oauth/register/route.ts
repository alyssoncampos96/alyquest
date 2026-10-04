import { randomBytes } from "node:crypto";
import { createAnonClient } from "@/lib/supabase/anon";
import { allowedOAuthRedirect, MCP_SCOPE } from "@/lib/mcp-oauth";
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.redirect_uris) || !body.redirect_uris.length || body.redirect_uris.length > 5 || !body.redirect_uris.every((uri: unknown) => typeof uri === "string" && allowedOAuthRedirect(uri)) || !["none", "client_secret_post"].includes(body.token_endpoint_auth_method ?? "none")) return Response.json({ error: "invalid_client_metadata" }, { status: 400 });
  const name = String(body.client_name ?? "ChatGPT").slice(0, 80).trim() || "ChatGPT";
  const method = body.token_endpoint_auth_method ?? "none";
  const secret = method === "none" ? null : randomBytes(32).toString("base64url");
  const { data, error } = await createAnonClient().rpc("aq_mcp_register_client", { p_name: name, p_redirects: body.redirect_uris, p_secret: secret });
  if (error) return Response.json({ error: "temporarily_unavailable" }, { status: 503 });
  return Response.json({ client_id: data, ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}), client_id_issued_at: Math.floor(Date.now() / 1000), client_name: name, redirect_uris: body.redirect_uris, token_endpoint_auth_method: method, grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], scope: MCP_SCOPE }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
