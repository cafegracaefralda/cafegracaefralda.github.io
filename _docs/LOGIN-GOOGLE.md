# Ligar o login com Google (uma vez só, uns 15 minutos)

O site usa o login com Google para o chat entre pais e para agendar/desmarcar o café.
Quem faz o login só mostra o **primeiro nome**. O e-mail nunca aparece para outras pessoas.

## 1. Atualizar o banco (Supabase)
1. Abra o **SQL Editor** do projeto `cafegracaefralda`.
2. Cole o conteúdo de `_docs/supabase-v2.sql` e clique em **Run**. Deve aparecer "Success".

## 2. Criar a chave do Google
1. Acesse **https://console.cloud.google.com** com a sua conta Google.
2. No topo, clique no seletor de projetos → **Novo projeto** → nome `cafegracaefralda` → **Criar**.
3. Menu **APIs e serviços → Tela de permissão OAuth** (ou "Google Auth Platform"):
   - Tipo de usuário: **Externo**.
   - Nome do app: `Café, Graça & Fralda`. E-mail de suporte: o seu.
   - Em **Domínios autorizados**, adicione `supabase.co`.
   - Salve. Depois, em **Público**, clique em **Publicar app** (assim qualquer pessoa pode entrar).
4. Menu **Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**. Nome: `Site`.
   - **Origens JavaScript autorizadas:** `https://cafegracaefralda.com.br`
   - **URIs de redirecionamento autorizados:** `https://ckzeechkxghhmoshgzyv.supabase.co/auth/v1/callback`
   - Clique em **Criar** e copie o **ID do cliente** e a **Chave secreta do cliente**.

## 3. Colocar a chave no Supabase
1. No Supabase: **Authentication → Sign In / Providers → Google**.
2. Ligue **Enable Sign in with Google**, cole o **Client ID** e o **Client Secret** e salve.
3. Em **Authentication → URL Configuration**:
   - **Site URL:** `https://cafegracaefralda.com.br`
   - **Redirect URLs:** adicione `https://cafegracaefralda.com.br/**`
     (quando ligar um domínio próprio, adicione ele aqui também).
4. Em **Authentication → Sign In / Providers**, deixe **desligado** o login por e-mail
   (só o Google fica ligado). Isso impede que alguém se passe por administrador.

## 4. Virar administrador (Painel do Denny)
1. Entre no site com o **seu Google** pelo menos uma vez.
2. No **SQL Editor**, rode (trocando pelo e-mail que você usou no login):
   ```sql
   insert into public.admins (email) values ('SEU_EMAIL_DO_GOOGLE@gmail.com');
   ```
3. Atualize o site. Aparece **Painel** no menu da sua conta.

## Segurança
- A chave pública do Supabase fica no site de propósito. As regras do banco (RLS) protegem os dados.
- **Nunca** envie a `secret key` do Supabase nem a chave secreta do Google em conversas ou no código.
