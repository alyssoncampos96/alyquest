# AlyQuest MCP

Endpoint: https://alyquestv3.vercel.app/api/mcp

O servidor implementa Streamable HTTP stateless com respostas JSON. Suporta initialize, ping, tools/list, tools/call e notificações. GET e DELETE autenticados retornam 405 porque não há SSE nem sessões persistentes. Todos os métodos MCP exigem o Bearer Token de integração existente; tokens ausentes, revogados ou inválidos recebem 401. A autenticação usa a consulta existente de status de jejum; esta não altera sessões e apenas atualiza last_used_at do token, como os outros endpoints GPT.

As 15 ferramentas são derivadas do OpenAPI local e executam diretamente os handlers /api/gpt, sem encaminhar credenciais a URLs externas ou duplicar regras de negócio. Datas explícitas mantêm o contrato existente. As instruções MCP fixam America/Sao_Paulo para interpretar datas relativas e exigem consultar IDs reais. A validação exige horários com fuso e rejeita IDs malformados; a existência e autorização dos IDs são verificadas pelos handlers e RPCs existentes.

## Conectar

Use mcp.json na configuração do plugin. Configure o Bearer Token no campo seguro de autenticação da conexão. O arquivo não contém token. Não coloque credenciais em arquivos, prompts ou na URL. O mcp.json sozinho não configura autenticação.

## Verificar

GET /api/mcp/health é público e retorna apenas disponibilidade do serviço, versão e fuso. Não acessa dados do usuário ou o banco. A presença desse healthcheck não confirma uma conexão autenticada ao banco.

Para chamadas MCP, envie POST com Content-Type: application/json e Accept: application/json, text/event-stream, além do Authorization: Bearer configurado de forma segura. Inicialize o cliente e teste tools/list, ping ou listarTarefasOuMissoes sem criar ou concluir registros.

## Publicar na Vercel

Execute npm test, npm run lint e npm run build. Envie a branch codex/alyquest-doc-adjustments ao repositório; a Vercel cria um Preview. Quando estiver Ready, use Promote to Production no projeto alyquestv3. Preserve as variáveis de Supabase existentes. Não há nova variável secreta, dependência ou migração para o MCP. Evite atualizar main: a documentação anterior informa que ela também publica outros projetos.
