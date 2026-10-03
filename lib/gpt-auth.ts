import { type NextRequest } from "next/server";

export function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const [type, token] = header.split(/\s+/);
  return type?.toLowerCase() === "bearer" ? token : "";
}

export function parseJsonError(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível registrar.";
}
