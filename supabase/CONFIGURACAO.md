# Ativação do painel online da PuraPolpa

Faça a configuração abaixo antes de ativar a Supabase na Vercel. A vitrine e o pedido por WhatsApp continuam públicos. O catálogo é compartilhado pelas contas administrativas autorizadas.

## 1. Criar o projeto e o banco

1. No painel da Supabase, crie um projeto e guarde a senha do PostgreSQL no seu gerenciador de senhas. Prefira uma região próxima da operação.
2. Abra **SQL Editor → New query**, copie todo o arquivo [001_catalogo.sql](migrations/001_catalogo.sql) e clique em **Run**. Execute esta migração uma vez, no projeto escolhido. Ela cria as tabelas privadas, políticas RLS e duas funções públicas de acesso administrativo.
3. Execute também [002_pedidos.sql](migrations/002_pedidos.sql) no SQL Editor desse projeto. O checkout usa a chave pública e a URL já configuradas para o painel online. Publique o site com essas variáveis depois da migração.
4. Mantenha a **Data API** habilitada e o schema `public` exposto. A função `pp_registrar_pedido` recebe pedidos da vitrine e calcula o subtotal no banco. A busca por número ou nome fica no painel administrativo. O frete de entrega é combinado com o atendente no WhatsApp.

## 2. Criar e autorizar o administrador

1. Em **Authentication → Sign In / Providers**, habilite login por e-mail e senha. Em **Authentication**, desative a opção que permite o cadastro público de novos usuários.
2. Em **Authentication → Users → Add user → Create new user**, crie `purapolpaacaioficial@gmail.com` com uma senha forte e marque a confirmação do e-mail, após conferir o endereço.
3. No **SQL Editor**, execute a consulta a seguir. O resultado deve exibir um UUID. Se vier vazio, confira o e-mail em **Users**. Execute apenas para contas que devem poder ler e editar todos os custos.

```sql
insert into purapolpa.administradores (usuario)
select id from auth.users
where lower(email) = 'purapolpaacaioficial@gmail.com'
on conflict do nothing;

select usuario from purapolpa.administradores
where usuario = (select id from auth.users where lower(email) = 'purapolpaacaioficial@gmail.com');
```

## 3. Configurar os links e o e-mail

1. Em **Authentication → URL Configuration**, defina **Site URL** como `https://purapolpaacai.vercel.app` e adicione `https://purapolpaacai.vercel.app/admin.html` em **Redirect URLs**. Se mudar de domínio, atualize ambos.
2. Em **Authentication → Email Templates → Reset Password** (ou **Reset password** em **Emails**), use o assunto **PuraPolpa · Redefina sua senha** e cole o conteúdo de [email-recuperacao.html](email-recuperacao.html). O painel usa o link com `RedirectTo` e `TokenHash` desse modelo.
3. Configure **Custom SMTP** na Supabase para entrega em produção. Se usar o Gmail da marca, informe remetente e usuário `purapolpaacaioficial@gmail.com`, nome **PuraPolpa**, servidor `smtp.gmail.com`, porta `465` com TLS e uma senha de app Google. A conta precisa ter verificação em duas etapas e permitir senhas de app. A credencial SMTP fica na Supabase. [SMTP na Supabase](https://supabase.com/docs/guides/auth/auth-smtp) · [Senhas de app Google](https://support.google.com/accounts/answer/185833?hl=pt-BR)
4. Se usar um provedor de e-mail transacional, preencha os dados SMTP e o remetente autorizado por ele. A conta de login do administrador continua sendo o e-mail criado no passo 2.

## 4. Conectar a Vercel

1. Na Supabase, copie a **Project URL** em **Connect** e a **Publishable key** em **Settings → API Keys**.
2. Na Vercel, abra o projeto **purapolpaacai → Settings → Environment Variables**. Crie no ambiente **Production**:

| Nome | Valor |
| --- | --- |
| `SUPABASE_URL` | URL HTTPS do projeto, por exemplo `https://SEU-PROJETO.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública com prefixo `sb_publishable_` |

Esses dois valores são incorporados ao JavaScript do painel. A autorização é aplicada no banco. Mantenha senhas, chaves `service_role` e `sb_secret_` fora desses campos. [Chaves da Supabase](https://supabase.com/docs/guides/api/api-keys)

3. Mantenha a raiz da Vercel em `./`. Em **Deployments**, faça **Redeploy** da versão atual para que o build receba as variáveis. Use o domínio de produção. A tela do painel deve pedir **E-mail**.
4. Entre com a senha da conta criada na Supabase. Caso a conta entre mas o catálogo recuse acesso, confira o UUID autorizado no passo 2. O modo online usa Supabase Auth para a recuperação e dispensa o Redis e as variáveis do remetente na Vercel.

## 5. Importar o catálogo antigo

1. Antes de cadastrar itens online, abra `/admin.html` **no mesmo navegador, perfil e domínio** em que você salvou os itens locais. O catálogo online deve estar vazio. A importação preserva os identificadores dos produtos e seus vínculos com as receitas.
2. Entre com o **e-mail e a senha da Supabase**. Abra **Importar catálogo deste navegador**, digite a **senha local anterior** e clique em **Importar itens**. A transação copia todo o catálogo de uma vez e preserva a cópia criptografada local.
3. Compare a quantidade de itens, o peso e o custo de uma receita. Entre pelo celular com a mesma conta e consulte essa receita. Uma segunda tentativa de importação em catálogo preenchido é recusada para evitar substituições.
4. Na tela de login, preencha o e-mail, clique em **Esqueci minha senha** e abra o link recebido. Escolha a nova senha, entre novamente e confira o catálogo.

Se os dados estavam em outro endereço (como o antigo site privado), o navegador isola os dados desse domínio. A importação direta exige executar o painel configurado naquele endereço de origem. Mantenha o navegador e os dados antigos até concluir a conferência.

## Operação

O custo de receitas com componentes é calculado no PostgreSQL a partir das quantidades e preços atuais. Receitas de custo manual conservam os totais informados. Se duas pessoas editarem enquanto o catálogo muda, o painel pede para recarregar antes de salvar. Para retirar acesso, exclua a linha do administrador em `purapolpa.administradores`. As políticas são verificadas a cada consulta e gravação.
