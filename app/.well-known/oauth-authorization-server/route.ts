import { oauthMetadata } from "@/lib/mcp-oauth";
export async function GET() { return Response.json(oauthMetadata(), { headers: { "Cache-Control": "no-store" } }); }
