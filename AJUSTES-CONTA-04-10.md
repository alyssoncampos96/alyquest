# Ajustes de conta e categorias

Implementado no código local:

- Nome obrigatório no cadastro, salvo em `auth.users.raw_user_meta_data.display_name`.
- Edição do nome em **Meu Personagem**; nome exibido no início, personagem e arena.
- Categorias próprias criadas no formulário de missão, persistidas nos metadados da conta e disponíveis nas próximas missões, edições, recorrências e filtros. As categorias padrão e os valores de tarefas existentes são preservados.
- Confirmação de e-mail trata código PKCE, token hash e tokens no fragmento da URL. A troca é executada uma vez, e a navegação só ocorre após validar o usuário e salvar a sessão.
- Atualização da sessão ao voltar ao app, ao trocar de aba e nos eventos de autenticação.

## Ativação no ambiente hospedado

1. Aplicar `supabase/migrations/202610040200_custom_task_categories.sql` antes de publicar. O arquivo remove apenas a antiga lista restrita de categorias, caso exista, e preserva as tarefas.
2. Publicar o código com as variáveis públicas do Supabase já usadas pelo projeto.
3. Conferir que a URL do app e `/auth/callback` estão autorizadas em **Authentication → URL Configuration** no Supabase.
4. Para confirmação que também funciona quando o link é aberto em outro navegador, usar no template **Confirm signup**:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirmar meu e-mail</a>
   ```

   O fluxo PKCE padrão depende do navegador onde o cadastro começou. O código agora direciona ao login com uma mensagem explicativa quando falta o verificador; o template acima permite confirmar diretamente com o token hash.

## Verificação em produção

- Cadastrar uma conta com nome próprio, confirmar o e-mail e entrar sem reiniciar.
- Abrir o link no navegador do e-mail e voltar ao app instalado; se o sistema isolar os cookies do app e do navegador, autenticar no app com e-mail e senha.
- Alterar o nome e conferir início, personagem e arena.
- Criar uma categoria, salvar uma missão nela e conferir que aparece após recarregar e em outra sessão da mesma conta.
- Conferir que outra conta não recebe as categorias criadas.
- Validar recuperação de senha e link expirado.

As configurações remotas, migração e envio real de e-mail não foram executados nesta sessão: não há conexão administrativa disponível com o ambiente hospedado.
