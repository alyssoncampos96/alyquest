# Ajustes do documento AlyQuest — 28/09/2026

## Entregas
- Espaço superior respeita a área segura do iPhone em modo instalado.
- Missões usam um único cartão para dados, etapas, edição e conclusão.
- Criação de missão e chefe em botões compactos no topo, com formulário modal acessível.
- Filtros por categoria e por status (pendentes, concluídas, todas).
- Tipo Tarefa única (sem etapas), mantendo tarefas com etapas e treinos. A recorrência é configurada separadamente.
- Seletor nativo de datas com ícone visível no tema escuro.
- Foco permite várias missões e Outra atividade com descrição; círculo mostra tempo restante. Atividades e duração ficam fixas durante o ciclo. Reiniciar permite mudar a seleção.
- UUID por ciclo torna tentativas de salvar idempotentes. As recompensas continuam sendo por fase, nunca por quantidade de tarefas.
- Treinos têm acesso próprio na navegação, calendário de sete dias, histórico e biblioteca de módulos.
- Módulos próprios ou predefinidos podem ser escolhidos ao criar um treino. Cada sessão recebe uma cópia independente.
- Recorrências de treino geram sessões até seis dias à frente. Alterar o modelo afeta apenas ocorrências ainda não geradas; as existentes podem ser editadas individualmente.
- 50 propostas de conquistas em /achievements/ideas e CONQUISTAS-SUGERIDAS.md, sem inventar medalhas ganhas ou alterar recompensas.

## Planilha
Fonte indicada pelo usuário: aba Tarefas, filtrada por responsável (Alysson Campos).
A fonte já permite leitura CSV sem autenticação adicional; nenhuma permissão da planilha foi alterada.
O botão Conectar / sincronizar importa tarefas ativas. A tela verifica novas tarefas a cada cinco minutos enquanto estiver aberta, após a primeira conexão.
A chave id_tarefa impede duplicatas. Conclusões e edições locais são preservadas; não há escrita na planilha nem sincronização bidirecional de status. Tarefas concluídas/canceladas na origem não são importadas como novas missões. Horas iniciais são 1h e podem ser editadas antes de concluir.
Dados são isolados por usuário no Supabase. Não há chave administrativa no aplicativo.

## Banco e validação
Migrações aditivas aplicadas: 202609280120_doc_adjustments.sql e 202609280130_sheets.sql.
Testes em supabase/tests/doc-adjustments-rollback.sql verificaram geração de sete treinos, cópias de módulos, recompensas idempotentes do foco, importação sem duplicatas, preservação de conclusão e isolamento RLS. Todos os dados de teste foram desfeitos; nenhum registro de teste ficou persistido.
Testes Node, lint, TypeScript e build de produção executados. Navegação autenticada e importação real conferidas no navegador.
.env.local preservado.

## Publicação e próximas atualizações
Endereço permanente do projeto V3: https://alyquestv3.vercel.app/.
O link com hash corresponde a uma versão específica; use o endereço permanente no iPhone.
Os quatro projetos Vercel estão ligados ao mesmo repositório. Para atualizar apenas V3, publicar a branch de ajustes como preview e promovê-la no projeto alyquestv3. Um push em main pode publicar também nos outros projetos.
Fluxo: solicitar ajuste → editar código → validar → aplicar migração aditiva, se necessária → publicar preview → verificar → promover no V3. Não recriar banco, não substituir .env.local e não copiar ZIP sobre o projeto.
No iPhone: abrir o endereço permanente no Safari → Compartilhar → Adicionar à Tela de Início. Atualizações aparecem ao reabrir/recarregar; requer conexão com a internet.
