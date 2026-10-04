// Public availability probe: no user data, database calls or credentials.
export async function GET() {
  return Response.json({ ok: true, service: "alyquest-mcp", version: "1.0.0", timezone: "America/Sao_Paulo" }, { headers: { "Cache-Control": "no-store" } });
}
