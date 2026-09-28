# Treinos, recorrências e chefes

Implementado e aplicado no Supabase em 27/09/2026. O servidor local continua em http://localhost:3000.

## Como usar

### Treinos modulares

1. Em Missões, abra **🏋️ Treinos**.
2. **Criar treino** cria a missão, única ou recorrente.
3. Na sessão pendente, adicione Corrida, Braços, Abdominal, Mobilidade ou um módulo da sua biblioteca.
4. Ajuste séries, repetições, carga, km ou tempo. Registre o realizado e marque etapas.
5. Clique em **Salvar progresso** antes de sair ou concluir. A sessão não altera os modelos.
6. Conclua a missão para receber suas recompensas uma única vez. É possível encerrar com progresso parcial.
7. O histórico conserva os valores registrados e permite **Repetir treino hoje**, copiando as metas e zerando o checklist e o campo realizado.

A biblioteca permite criar e editar módulos próprios. As predefinições são exemplos editáveis. Tarefas comuns também podem ter etapas.

### Recorrências

Em **Nova missão**, escolha diariamente, semanalmente, mensalmente ou anualmente; personalize o intervalo. Na opção semanal, escolha os dias. Defina término nunca, por data ou por quantidade total da série.

Cada ocorrência possui conclusão, etapas e recompensas próprias. As ocorrências devidas são materializadas ao abrir o app, a cada minuto com a tela visível ou ao voltar ao app. A primeira ocorrência pode ser futura. Não depende de cron nem mantém um calendário infinito de linhas futuras.

O fuso é America/Sao_Paulo. Datas mensais/anuais inexistentes usam o último dia do mês. A materialização tem limites por execução para evitar travamentos em grandes atrasos e continua nas próximas sincronizações.

Na missão, escolha **Só esta ocorrência** ou **Esta e as próximas ainda não geradas**. Outras ocorrências já criadas e o histórico são preservados. Na seção **Recorrências**, é possível editar o modelo mesmo sem tarefa pendente, pausar e reativar. Reativar recupera ocorrências devidas durante a pausa. A data inicial da série é mantida como âncora; a quantidade é o total da série, não apenas as restantes.

### Chefes

Em Chefes, use **Criar chefe**: nome, categoria, HP, descrição e prazo opcional. Em Missões, crie ou edite uma tarefa e selecione **Chefe/meta**. Funciona também no modelo de recorrência.

Editar o HP preserva o dano já causado. Chefes derrotados permanecem no histórico. As funções originais de recompensas foram mantidas. A função existente completa tarefas, concede XP/moedas e causa dano em uma transação, sem recompensar duas vezes.

## Supabase e SQL

As migrações abaixo **já foram aplicadas pelo SQL Editor**; não executar novamente no mesmo banco. São aditivas e não removem as tabelas/rotinas existentes:

- `supabase/migrations/202609280100_planning.sql`: aq_routines, aq_task_plans, aq_workout_modules, políticas RLS e funções validadas.
- `supabase/migrations/202609280110_planning_details.sql`: descrição/prazo de chefe, edição de modelos e repetição de treino.

As novas tabelas são legíveis somente pelo dono autenticado. Escritas passam pelas funções que validam identidade, propriedade e dados, com search_path fixo. Chaves administrativas não foram copiadas para o app nem para .env.local.

`supabase/tests/planning-rollback.sql` é um teste de integração reproduzível, com ROLLBACK. Foi executado usando o papel authenticated: gravação, cópia de treino, edição de série, recompensas, idempotência e isolamento passaram, sem deixar tarefas de teste. Um teste adicional validou derrota de chefe, bônus final, limites de mês/ano bissexto, intervalo semanal e rejeição anônima.

`npm run lint`, `npm run build` (incluindo TypeScript) e 11 testes locais passaram. Navegador: missões, filtros, opções de recorrência, biblioteca e combinação Corrida + Abdominal verificados. O .env.local foi preservado.

## iPhone

Na mesma rede Wi-Fi do Mac, abra no Safari:

http://192.168.15.14:3000

O endereço respondeu HTTP 200 no teste local. Faça login no iPhone; a sessão do Mac não é transferida automaticamente. Deixe o Mac ligado e `npm run dev` em execução. O IP pode mudar quando a rede for reconectada.

No Safari: Compartilhar → Adicionar à Tela de Início → Adicionar. Quando disponível, mantenha Abrir como App da Web ativado. O manifesto e o ícone Apple estão configurados.

Para uso fora da rede, com o Mac desligado e endereço permanente, é necessário publicar o Next.js com HTTPS e configurar as URLs de autenticação no Supabase. Publicação não realizada nesta etapa. Não há modo offline nem notificações push.

Referência: https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios

## Arquivos desta entrega

- app/tasks/page.tsx, app/workouts/page.tsx, app/bosses/page.tsx
- app/planning-actions.ts, app/actions.ts, app/page.tsx, app/layout.tsx
- components/mission-form.tsx, components/recurrence-fields.tsx, components/step-editor.tsx
- components/routine-sync.tsx, components/boss-form.tsx, components/action-form.tsx
- lib/planning.ts, lib/planning-server.ts, lib/types.ts
- tests/planning.test.mjs, tests/audit.test.mjs
- supabase/migrations/*.sql, supabase/tests/planning-rollback.sql

Backup inicial dos arquivos substituídos: /tmp/alyquest-planning-backup-20260927223403.
