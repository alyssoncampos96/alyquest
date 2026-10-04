import { protectedResourceMetadata } from "@/lib/mcp-oauth";
export async function GET() { return Response.json(protectedResourceMetadata(), { headers: { "Cache-Control": "no-store" } }); }
