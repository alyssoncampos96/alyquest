import { NextResponse, type NextRequest } from "next/server";

const auth = [{ bearerAuth: [] }];
const errorResponses = {
  "400": { description: "Dados inválidos" },
  "401": { description: "Token ausente ou inválido" },
};

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "AlyQuest Assistente",
      version: "1.2.0",
      description: "Ações autorizadas para usar o AlyQuest via IA: tarefas, finanças, jejum, loja e equipamentos.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/gpt/finance/expense": {
        post: {
          operationId: "registrarLancamentoFinanceiro",
          summary: "Registra despesa ou receita pessoal no AlyQuest",
          description: "Use para frases como 'registra almoço de 45 reais hoje'. Por padrão registra despesa; use kind=income para receita.",
          security: auth,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "amount", "occurred_on"],
                  properties: {
                    title: { type: "string", description: "Descrição curta. Exemplo: almoço" },
                    amount: { type: "number", description: "Valor em reais" },
                    kind: { type: "string", enum: ["expense", "income"], default: "expense" },
                    occurred_on: { type: "string", format: "date", description: "Data no formato YYYY-MM-DD" },
                    category: { type: "string", description: "Categoria. Exemplo: Alimentação, Mercado, Transporte" },
                    payment_method: { type: "string", enum: ["cash", "pix", "debit", "credit", "bank_transfer", "other"] },
                    installments: { type: "integer", minimum: 1, maximum: 120, description: "Quantidade de parcelas" },
                    notes: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Lançamento registrado" }, ...errorResponses },
        },
      },
      "/api/gpt/finance/list": {
        post: {
          operationId: "listarLancamentosFinanceiros",
          summary: "Lista lançamentos financeiros por mês, categoria e tipo",
          security: auth,
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    month: { type: "string", pattern: "^\\d{4}-\\d{2}$", description: "Mês no formato YYYY-MM. Se vazio, usa o mês atual." },
                    category: { type: "string", description: "Filtro opcional por categoria exata" },
                    kind: { type: "string", enum: ["expense", "income"], description: "Filtro opcional por despesa ou receita" },
                    limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Lançamentos encontrados" }, ...errorResponses },
        },
      },
      "/api/gpt/finance/summary": {
        post: {
          operationId: "consultarResumoFinanceiro",
          summary: "Consulta resumo financeiro mensal",
          description: "Retorna total de receitas, despesas, saldo, contagem e quebra por categoria.",
          security: auth,
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    month: { type: "string", pattern: "^\\d{4}-\\d{2}$", description: "Mês no formato YYYY-MM. Se vazio, usa o mês atual." },
                    category: { type: "string", description: "Filtro opcional por categoria exata" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Resumo calculado" }, ...errorResponses },
        },
      },
      "/api/gpt/tasks/create": {
        post: {
          operationId: "criarMissao",
          summary: "Cria uma missão no AlyQuest",
          security: auth,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title"],
                  properties: {
                    title: { type: "string" },
                    category: { type: "string", default: "Pessoal" },
                    priority: { type: "string", enum: ["low", "medium", "high"], default: "medium" },
                    estimated_hours: { type: "number", minimum: 0.5, default: 1 },
                    due_date: { type: "string", format: "date", description: "Prazo no formato YYYY-MM-DD" },
                    notes: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Missão criada" }, ...errorResponses },
        },
      },
      "/api/gpt/tasks/list": {
        post: {
          operationId: "listarMissoes",
          summary: "Lista missões do AlyQuest",
          security: auth,
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    scope: { type: "string", enum: ["today", "pending", "overdue", "all"], default: "today" },
                    limit: { type: "integer", minimum: 1, maximum: 50, default: 12 },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Missões encontradas" }, ...errorResponses },
        },
      },
      "/api/gpt/tasks/complete": {
        post: {
          operationId: "concluirMissao",
          summary: "Conclui uma missão e aplica recompensas",
          description: "Use task_id quando souber o ID. Se usar query e houver mais de uma missão parecida, a resposta virá como ambiguous e o GPT deve perguntar qual concluir.",
          security: auth,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    task_id: { type: "string", format: "uuid" },
                    query: { type: "string", description: "Trecho do título da missão, quando não houver task_id" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Missão concluída ou lista de candidatos ambíguos" }, ...errorResponses },
        },
      },
      "/api/gpt/fasting/start": {
        post: {
          operationId: "iniciarJejum",
          summary: "Inicia um jejum ativo",
          security: auth,
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    started_at: { type: "string", format: "date-time", description: "Data e hora de início. Se vazio, usa agora." },
                    notes: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Jejum iniciado ou sessão ativa existente retornada" }, ...errorResponses },
        },
      },
      "/api/gpt/fasting/status": {
        post: {
          operationId: "consultarJejum",
          summary: "Consulta o jejum ativo e a duração atual",
          security: auth,
          responses: { "200": { description: "Status do jejum" }, ...errorResponses },
        },
      },
      "/api/gpt/fasting/finish": {
        post: {
          operationId: "finalizarJejum",
          summary: "Finaliza um jejum e aplica recompensas",
          description: "Se session_id não for enviado, finaliza o jejum ativo. Também pode registrar um jejum passado com started_at e ended_at.",
          security: auth,
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    session_id: { type: "string", format: "uuid" },
                    started_at: { type: "string", format: "date-time" },
                    ended_at: { type: "string", format: "date-time", description: "Se vazio, usa agora." },
                    notes: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Jejum finalizado" }, ...errorResponses },
        },
      },

      "/api/gpt/tasks/state": {
        post: {
          operationId: "alterarEstadoMissao",
          summary: "Adia, cancela, pula ou restaura uma missão",
          security: auth,
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, required: ["task_id", "action"], properties: { task_id: { type: "string", format: "uuid" }, action: { type: "string", enum: ["postpone", "cancel", "skip", "restore"] }, date: { type: "string", format: "date", description: "Obrigatório para postpone" } } } } } },
          responses: { "200": { description: "Missão atualizada" }, ...errorResponses },
        },
      },
      "/api/gpt/finance/recurring": {
        post: {
          operationId: "criarRecorrenciaFinanceira",
          summary: "Cria gasto ou receita recorrente",
          security: auth,
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, required: ["title", "amount", "start_on"], properties: { title: { type: "string" }, amount: { type: "number" }, kind: { type: "string", enum: ["expense", "income"], default: "expense" }, category: { type: "string" }, start_on: { type: "string", format: "date" }, frequency: { type: "string", enum: ["weekly", "monthly", "yearly"], default: "monthly" }, payment_method: { type: "string", enum: ["cash", "pix", "debit", "credit", "bank_transfer", "other"] }, notes: { type: "string" } } } } } },
          responses: { "200": { description: "Recorrência criada" }, ...errorResponses },
        },
      },
      "/api/gpt/shop/list": {
        post: {
          operationId: "listarLojaInventario",
          summary: "Lista moedas, loja, itens comprados e equipados",
          security: auth,
          responses: { "200": { description: "Loja e inventário" }, ...errorResponses },
        },
      },
      "/api/gpt/shop/purchase": {
        post: {
          operationId: "comprarItemLoja",
          summary: "Compra item da loja e opcionalmente equipa",
          security: auth,
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, required: ["item_id"], properties: { item_id: { type: "string", format: "uuid" }, equip: { type: "boolean", default: false } } } } } },
          responses: { "200": { description: "Item comprado" }, ...errorResponses },
        },
      },
      "/api/gpt/shop/equip": {
        post: {
          operationId: "equiparItemLoja",
          summary: "Equipa ou desequipa item comprado",
          security: auth,
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, required: ["item_id"], properties: { item_id: { type: "string", format: "uuid" } } } } } },
          responses: { "200": { description: "Item atualizado" }, ...errorResponses },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
    },
  });
}
