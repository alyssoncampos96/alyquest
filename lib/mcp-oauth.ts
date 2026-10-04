export const MCP_ORIGIN = "https://alyquestv3.vercel.app";
export const MCP_RESOURCE = `${MCP_ORIGIN}/api/mcp`;
export const MCP_SCOPE = "alyquest";
export const MCP_CHALLENGE = `Bearer resource_metadata="${MCP_ORIGIN}/.well-known/oauth-protected-resource/api/mcp", scope="alyquest"`;
export function allowedOAuthRedirect(value: string) {
  try {
    const url = new URL(value);
    return url.origin === "https://chatgpt.com" && !url.search && !url.hash && (url.pathname === "/connector_platform_oauth_redirect" || /^\/connector\/oauth\/[A-Za-z0-9_-]+$/.test(url.pathname));
  } catch { return false; }
}
export function parseOAuthRequest(params: URLSearchParams) {
  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const challenge = params.get("code_challenge") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(clientId) || !allowedOAuthRedirect(redirectUri) || params.get("response_type") !== "code" || params.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(challenge) || params.get("resource") !== MCP_RESOURCE || (params.get("scope") ?? MCP_SCOPE) !== MCP_SCOPE || (params.get("state")?.length ?? 0) > 2048) return null;
  return { clientId, redirectUri, challenge, state: params.get("state") ?? "" };
}
export function oauthMetadata() {
  return { issuer: MCP_ORIGIN, authorization_endpoint: `${MCP_ORIGIN}/oauth/authorize`, token_endpoint: `${MCP_ORIGIN}/oauth/token`, registration_endpoint: `${MCP_ORIGIN}/oauth/register`, response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"], token_endpoint_auth_methods_supported: ["none", "client_secret_post"], code_challenge_methods_supported: ["S256"], scopes_supported: [MCP_SCOPE], authorization_response_iss_parameter_supported: true };
}
export function protectedResourceMetadata() {
  return { resource: MCP_RESOURCE, authorization_servers: [MCP_ORIGIN], scopes_supported: [MCP_SCOPE], bearer_methods_supported: ["header"], resource_name: "AlyQuest" };
}
