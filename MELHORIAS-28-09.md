# AlyQuest — melhorias de 28/09/2026

- Início mostra missões e treino de hoje, com atrasadas, sem data e futuras separadas.
- Cartões compactos com concluir, adiar, editar e cancelar. Ocorrências podem ser puladas e restauradas.
- Cada etapa marcada rende 1 XP e 1 moeda. Desmarcar reverte a etapa. Missão com etapas rende mais 1 ao concluir; missões sem etapas preservam a regra por duração.
- Confirmação de recompensa e dano; desfazer por até 5 minutos reverte conclusão, moedas, XP e dano/derrota do chefe. Etapas realizadas continuam marcadas e remuneradas. Alterações posteriores no chefe exigem desfazer na ordem inversa.
- Autosave com revisão para evitar sobrescrever outra aba; salvamento antes de concluir, trocar dia ou usar a navegação inferior.
- Treinos: seletor compacto de sete dias, um dia por vez; módulos selecionáveis com prévia; exercícios com checkbox e meta, edição em Ajustar. Biblioteca e histórico preservados. Último resultado por exercício e repetir treino disponíveis.
- Recorrências: ocorrência atual, atual e próximas, ou série pendente. Concluídas preservadas; alterações de frequência arquivam ocorrências substituídas.
- Seletor de data contido no formulário na largura de iPhone.
- Nome do projeto e status na origem nos cartões importados; última leitura na importação.
- Foco com filtros por categoria, preservando seleção entre filtros.
- Dez conquistas adicionais, sem recompensas extras, preservando as seis existentes.

## Planilha

O Supabase continua armazenando todas as alterações do app. A escrita Google envia apenas o status da linha identificada pelo ID original e responsável Alysson Campos. Concluir envia Concluído; desfazer restaura o status anterior. Conflitos de status, identificador duplicado e mudança de responsável impedem a escrita; falhas ficam pendentes para nova tentativa. Fila com versão e bloqueio temporário evita entregas concorrentes da mesma tarefa.
Variáveis GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_SHEETS_OWNER_ID e GOOGLE_SHEETS_WRITE_ENABLED configuradas em Production e Preview do alyquestv3. As duas primeiras chaves foram revogadas; a terceira foi validada. Nenhum arquivo de credencial faz parte do repositório; `.env.local` preservado.

## Verificação

21 testes automatizados, lint e build Next.js 16.3.6. Teste transacional no Supabase passou: quatro etapas + conclusão = cinco pontos/moedas, duplicidade, revisões concorrentes, desfazer, cancelamento/adiamento, dano/derrota/reversão de chefe, recorrências, fila versionada e RLS. Tudo revertido, zero tarefas de teste restantes.
O código de entrega foi testado com a API Google real em linha vazia temporária: Pendente → Concluído → Pendente, seguida da restauração da linha vazia. O acesso Supabase da entrega foi simulado nesse teste; suas regras foram testadas separadamente no banco. Nenhuma tarefa real foi concluída como teste.
Verificação visual em localhost a 390 px: treinos, combinação de módulos, seletor de data sem transbordamento e filtros do Pomodoro preservando seleção.
