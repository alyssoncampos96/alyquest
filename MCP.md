# AlyQuest MCP

Endpoint: https://alyquestv3.vercel.app/api/mcp

O servidor implementa Streamable HTTP stateless com respostas JSON. Suporta initialize, ping, tools/list, tools/call e notificações. GET e DELETE autenticados retornam 405 porque não há SSE nem sessões persistentes. Todos os métodos MCP exigem o Bearer Token de integração existente; tokens ausentes, revogados ou inválidos recebem 401. A autenticação usa a consulta existente de status de jejum; esta não altera sessões e apenas atualiza last_used_at do token, como os outros endpoints GPT.

As 15 ferramentas são derivadas do OpenAPI local e executam diretamente os handlers /api/gpt, sem encaminhar credenciais a URLs externas ou duplicar regras de negócio. Datas explícitas mantêm o contrato existente. As instruções MCP fixam America/Sao_Paulo para interpretar datas relativas e exigem consultar IDs reais. A validação exige horários com fuso e rejeita IDs malformados; a existência e autorização dos IDs são verificadas pelos handlers e RPCs existentes.

## Conectar

Use mcp.json na configuração do plugin. No ChatGPT, conecte usando OAuth. O host descobrirá os endpoints de autenticação, abrirá a tela do AlyQuest e solicitará autorização. Entre com sua conta e use “Conectar minha conta”. Não coloque credenciais em arquivos, prompts ou na URL. Tokens Bearer antigos continuam válidos para clientes que aceitam credenciais diretas. O mcp.json não contém credenciais.

## Verificar

GET /api/mcp/health é público e retorna apenas disponibilidade do serviço, versão e fuso. Não acessa dados do usuário ou o banco. A presença desse healthcheck não confirma uma conexão autenticada ao banco.

Para chamadas MCP, envie POST com Content-Type: application/json e Accept: application/json, text/event-stream, além do Authorization: Bearer configurado de forma segura. Inicialize o cliente e teste tools/list, ping ou listarTarefasOuMissoes sem criar ou concluir registros.

## Publicar na Vercel

Execute npm test, npm run lint e npm run build. Envie a branch codex/alyquest-doc-adjustments ao repositório; a Vercel cria um Preview. Quando estiver Ready, use Promote to Production no projeto alyquestv3. Preserve as variáveis de Supabase existentes. Não há nova variável secreta ou dependência. O login OAuth exige aplicar supabase/migrations/202610040100_mcp_oauth.sql antes de publicar a versão com OAuth. Evite atualizar main: a documentação anterior informa que ela também publica outros projetos.

## Login OAuth no ChatGPT

A descoberta RFC 9728 está em /.well-known/oauth-protected-resource/api/mcp; o desafio WWW-Authenticate aponta para ela. A descoberta RFC 8414 está em /.well-known/oauth-authorization-server. O servidor aceita código de autorização com PKCE S256 e emite tokens opacos vinculados ao cliente e ao recurso https://alyquestv3.vercel.app/api/mcp. Códigos duram cinco minutos e só podem ser trocados uma vez. Access tokens duram uma hora; refresh tokens são rotacionados a cada uso e expiram em 90 dias. Somente hashes dos códigos e tokens são armazenados. A integração aceita somente callbacks HTTPS oficiais do ChatGPT, validando o redirect registrado em cada etapa.

A autorização acontece na tela /oauth/authorize, com sessão autenticada do AlyQuest e decisão explícita do usuário. A opção /oauth/connections permite desconectar, revogando o access token e a renovação. O login preserva um destino interno seguro para retornar à autorização. Os tokens antigos têm expires_at nulo e continuam com o comportamento anterior. O RPC financeiro antigo agora usa o mesmo validador para respeitar validade e revogação.

Testes SQL em supabase/tests/mcp-oauth-rollback.sql verificam PKCE, autenticação do cliente, vinculação ao recurso, replay, renovação, validade, revogação e privilégios. Todos os registros usados nesses testes são desfeitos por rollback.
