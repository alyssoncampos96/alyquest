# Integração opcional de escrita

A escrita exige ativação explícita com GOOGLE_SHEETS_WRITE_ENABLED=true e está configurada em Production e Preview do projeto alyquestv3. O app salva alterações no Supabase e mantém a importação existente. As duas primeiras chaves geradas durante a configuração foram revogadas; a terceira foi validada com leitura, escrita e reversão em uma linha temporária. Nenhuma credencial deve entrar no repositório.

# Ativar atualização de status no Google Sheets

A leitura já funciona. Para a escrita automática, o app está preparado para uma conta de serviço exclusiva, com acesso apenas à planilha indicada.

1. No Google Cloud, habilitar Google Sheets API e criar uma conta de serviço sem papéis administrativos no projeto.
2. O titular deve criar/baixar a credencial JSON e guardá-la com segurança. Não colar em chats, commits ou arquivos públicos.
3. Compartilhar somente a planilha de tarefas com o e-mail dessa conta de serviço como Editor.
4. Na Vercel, projeto alyquestv3, configurar `GOOGLE_SERVICE_ACCOUNT_JSON` como variável sensível no ambiente Production e Preview. O valor é o JSON da credencial.
5. Configurar `GOOGLE_SHEETS_OWNER_ID` com o UUID da conta Alysson no Supabase (não é uma chave secreta). Isso restringe as escritas a essa conta do app.
6. Publicar novamente o V3 e usar Conectar / sincronizar.

A aplicação local usa as mesmas variáveis como configuração do servidor. Nunca usar prefixo NEXT_PUBLIC nessas credenciais.

A fila registra falhas e tenta novamente ao abrir/sincronizar Missões. Somente a célula de status é alterada, validando ID estável e responsável Alysson Campos. Desfazer retorna ao status anterior; alterações conflitantes na origem ficam pendentes para revisão. O app não modifica fórmulas ou outras colunas.

Referências: https://developers.google.com/identity/protocols/oauth2/service-account e https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/update
