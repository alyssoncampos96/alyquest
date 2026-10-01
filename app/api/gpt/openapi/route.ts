import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "AlyQuest",
      version: "1.0.0",
      description: "Registra informações pessoais autorizadas no AlyQuest.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/gpt/finance/expense": {
        post: {
          operationId: "registrarDespesa",
          summary: "Registra uma despesa pessoal no AlyQuest",
          security: [{ bearerAuth: [] }],
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
                    occurred_on: { type: "string", format: "date", description: "Data no formato YYYY-MM-DD" },
                    category: { type: "string", description: "Categoria. Exemplo: Alimentação" },
                    payment_method: { type: "string", enum: ["cash", "pix", "debit", "credit", "bank_transfer", "other"] },
                    installments: { type: "integer", minimum: 1, maximum: 120 },
                    notes: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Despesa registrada" },
            "400": { description: "Dados inválidos" },
            "401": { description: "Token inválido" },
          },
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
