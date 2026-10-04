// Stateless Streamable HTTP: JSON responses, no sessions or server-initiated SSE.
export type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; openWorldHint: boolean };
};
type Dependencies = {
  tools: Tool[];
  authenticate: (token: string) => Promise<boolean>;
  call: (name: string, args: Record<string, unknown>, token: string) => Promise<Response>;
};
const versions = ["2025-11-25", "2025-06-18", "2025-03-26"];
const headers = { "Cache-Control": "no-store" };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export function validateArguments(schema: Record<string, unknown>, args: Record<string, unknown>) {
  const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  for (const key of (schema.required ?? []) as string[]) if (!(key in args)) return `Campo obrigatório: ${key}.`;
  for (const [key, value] of Object.entries(args)) {
    const rule = properties[key];
    if (!rule) return `Campo desconhecido: ${key}.`;
    if (rule.type === "integer" ? !Number.isInteger(value) : typeof value !== rule.type) return `Tipo inválido: ${key}.`;
    if (Array.isArray(rule.enum) && !rule.enum.includes(value)) return `Valor inválido: ${key}.`;
    if (typeof value === "number" && (!Number.isFinite(value) || (typeof rule.minimum === "number" && value < rule.minimum) || (typeof rule.maximum === "number" && value > rule.maximum))) return `Valor fora do intervalo: ${key}.`;
    if (typeof value === "string") {
      if (typeof rule.pattern === "string" && !new RegExp(rule.pattern).test(value)) return `Formato inválido: ${key}.`;
      if (rule.format === "uuid" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return `ID inválido: ${key}. Consulte os IDs existentes.`;
      if (rule.format === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) return `Data inválida: ${key}.`;
      if (rule.format === "date-time" && (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))) return `Data e hora inválidas: ${key}. Inclua o fuso horário.`;
    }
  }
}

export function createMcpHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const fail = (id: unknown, code: number, message: string, status = 200) => Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status, headers });
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return fail(null, -32000, "Origem não permitida.", 403);
    const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
    if (!match) return new Response(null, { status: 401, headers: { ...headers, "WWW-Authenticate": "Bearer" } });
    try {
      if (!await deps.authenticate(match[1])) return new Response(null, { status: 401, headers: { ...headers, "WWW-Authenticate": "Bearer" } });
    } catch { return fail(null, -32603, "Não foi possível validar a autenticação.", 503); }
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { ...headers, Allow: "POST" } });
    const version = request.headers.get("mcp-protocol-version");
    if (version && !versions.includes(version)) return fail(null, -32600, "Versão MCP não suportada.", 400);
    const accept = request.headers.get("accept") ?? "";
    if (!accept.includes("application/json") || !accept.includes("text/event-stream")) return fail(null, -32600, "Accept deve incluir application/json e text/event-stream.", 406);
    if (!request.headers.get("content-type")?.includes("application/json")) return fail(null, -32600, "Content-Type deve ser application/json.", 415);
    let body: unknown;
    try { body = await request.json(); } catch { return fail(null, -32700, "JSON inválido.", 400); }
    if (!object(body) || body.jsonrpc !== "2.0" || typeof body.method !== "string" || (body.id !== undefined && typeof body.id !== "string" && typeof body.id !== "number") || (body.params !== undefined && !object(body.params))) return fail(null, -32600, "Requisição inválida.", 400);
    if (body.id === undefined) {
      if (!body.method.startsWith("notifications/")) return fail(null, -32600, "Requisição exige id.", 400);
      return new Response(null, { status: 202, headers });
    }
    const result = (value: unknown) => Response.json({ jsonrpc: "2.0", id: body.id, result: value }, { headers });
    const params = (body.params ?? {}) as Record<string, unknown>;
    if (body.method === "initialize") {
      if (typeof params.protocolVersion !== "string" || !object(params.capabilities) || !object(params.clientInfo)) return fail(body.id, -32602, "Parâmetros de inicialização inválidos.");
      return result({ protocolVersion: versions.includes(params.protocolVersion) ? params.protocolVersion : versions[0], capabilities: { tools: { listChanged: false } }, serverInfo: { name: "alyquest", version: "1.0.0" }, instructions: "Resolva datas relativas usando America/Sao_Paulo. Use datas YYYY-MM-DD e horários ISO com fuso. Consulte tarefas, loja ou inventário antes de usar IDs; nunca invente IDs." });
    }
    if (body.method === "ping") return result({});
    if (body.method === "tools/list") return result({ tools: deps.tools });
    if (body.method !== "tools/call") return fail(body.id, -32601, "Método não encontrado.");
    const tool = deps.tools.find(tool => tool.name === params.name);
    if (!tool) return fail(body.id, -32602, "Ferramenta desconhecida.");
    const args = params.arguments ?? {};
    if (!object(args)) return fail(body.id, -32602, "Argumentos devem ser um objeto.");
    const invalid = validateArguments(tool.inputSchema, args);
    if (invalid) return fail(body.id, -32602, invalid);
    try {
      const response = await deps.call(tool.name, args, match[1]);
      const data: unknown = await response.json();
      // Never return an upstream exception, raw body or credentials.
      const safe = JSON.stringify(data).split(match[1]).join("[redacted]");
      return result({ content: [{ type: "text", text: safe }], isError: !response.ok });
    } catch { return result({ content: [{ type: "text", text: "Não foi possível executar a ferramenta." }], isError: true }); }
  };
}
