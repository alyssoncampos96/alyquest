import { MCP_CHALLENGE } from "@/lib/mcp-oauth";
import { NextRequest } from "next/server";
import { GET as openapi } from "@/app/api/gpt/openapi/route";
import { createAnonClient } from "@/lib/supabase/anon";
import { createMcpHandler, type Tool } from "@/lib/mcp";
import { POST as handler0 } from "@/app/api/gpt/finance/expense/route";
import { POST as handler1 } from "@/app/api/gpt/finance/list/route";
import { POST as handler2 } from "@/app/api/gpt/finance/count/route";
import { POST as handler3 } from "@/app/api/gpt/finance/summary/route";
import { POST as handler4 } from "@/app/api/gpt/tasks/create/route";
import { POST as handler5 } from "@/app/api/gpt/tasks/list/route";
import { POST as handler6 } from "@/app/api/gpt/tasks/complete/route";
import { POST as handler7 } from "@/app/api/gpt/fasting/start/route";
import { POST as handler8 } from "@/app/api/gpt/fasting/status/route";
import { POST as handler9 } from "@/app/api/gpt/fasting/finish/route";
import { POST as handler10 } from "@/app/api/gpt/tasks/state/route";
import { POST as handler11 } from "@/app/api/gpt/finance/recurring/route";
import { POST as handler12 } from "@/app/api/gpt/shop/list/route";
import { POST as handler13 } from "@/app/api/gpt/shop/purchase/route";
import { POST as handler14 } from "@/app/api/gpt/shop/equip/route";

const handlers = {
  registrarLancamentoFinanceiro: handler0,
  listarLancamentosFinanceiros: handler1,
  contarLancamentosFinanceiros: handler2,
  consultarResumoFinanceiro: handler3,
  criarTarefaOuMissao: handler4,
  listarTarefasOuMissoes: handler5,
  concluirTarefaOuMissao: handler6,
  iniciarJejum: handler7,
  consultarJejum: handler8,
  finalizarJejum: handler9,
  alterarEstadoMissao: handler10,
  criarRecorrenciaFinanceira: handler11,
  listarLojaInventario: handler12,
  comprarItemLoja: handler13,
  equiparItemLoja: handler14,
};

export async function POST(request: NextRequest) {
  // Read the live local contract, avoiding a second, divergent set of schemas.
  const contract = await (await openapi(request)).json();
  const tools: Tool[] = Object.values(contract.paths).map((entry) => {
    const operation = (entry as { post: { operationId: string; summary: string; description?: string; requestBody?: { content: { "application/json": { schema: Record<string, unknown> } } } } }).post;
    const readOnly = /^(listar|contar|consultar)/.test(operation.operationId);
    return {
      name: operation.operationId,
      description: [operation.summary, operation.description, "Datas relativas: America/Sao_Paulo. Nunca invente IDs."].filter(Boolean).join(". "),
      inputSchema: operation.requestBody?.content["application/json"].schema ?? { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, openWorldHint: false },
    };
  });
  return createMcpHandler({
    tools,
    challenge: MCP_CHALLENGE,
    authenticate: async token => {
      const { data, error } = await createAnonClient().rpc("aq_gpt_fasting_status", { p_token: token });
      if (error && error.code !== "P0001") throw new Error("Authentication unavailable");
      return !error && !!data;
    },
    call: (name, args, token) => {
      const handler = handlers[name as keyof typeof handlers];
      return handler(new NextRequest(request.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(args),
      }));
    },
  })(request);
}

// Streamable HTTP permits 405 when there is no server-initiated SSE stream.
export const GET = POST;
export const DELETE = POST;
