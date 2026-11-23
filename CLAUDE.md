# Café, Graça & Fralda

Site e app (PWA) de Denny Silva: fé e família na vida real. Publicado em https://cafegracaefralda.github.io pelo GitHub Pages (branch `main`, pasta raiz). O Denny pede as mudanças pelo chat; ele não edita código.

## Como mudar e publicar
1. Edite os arquivos de `_src/` (nunca `index.html` nem `sw.js`, que são gerados):
   - `styles.css`: visual. `body.html`: estrutura das telas. `lessons.html`: "O que a gente aprendeu".
   - `js/00-core.js` (utilidades e Supabase) · `10-data.js` (devocionais e indicações) · `20-router.js` (telas) · `30-auth.js` (login Google)
     · `40-devocional.js` · `50-cafe.js` (agendar/desmarcar) · `55-palestra.js` (convite de palestra → WhatsApp) · `60-comunidade.js` (chat, comentários, indicações) · `62-mural.js` (mural das famílias) · `63-indicar.js` (indicar profissional) · `65-privado.js` (conversas privadas) · `70-painel.js` (painel do Denny) · `80-app.js` (instalar o app).
2. Rode `python3 _src/build.py` (precisa de Node): gera `index.html`, `sw.js`, `sitemap.xml`, `robots.txt` e uma página por devocional em `devocional/<slug>/` (SEO).
3. Teste antes de publicar: abra o site num navegador headless (Playwright em `/opt/pw-browsers/chromium`) em 1440px e 390px. Confira que não há erro de script e que a página não rola para o lado. O Supabase não é acessível da nuvem: teste com um mock de rede (rotas `https://ckzeechkxghhmoshgzyv.supabase.co/**`).
4. Commit em português, curto, e `git push origin main`. O GitHub Pages publica em 1 a 2 minutos.
5. Mostre ao Denny o que mudou (print ou resumo) e o link do site.

Mudanças de texto pequenas podem ser publicadas direto. Mudanças de layout, seções novas ou remoções: mostre um print e espere o "ok" dele antes do push para `main` (trabalhe numa branch e envie só a branch enquanto isso).

## Revisão da versão do WhatsApp (sempre)
Todo conteúdo novo (devocional, post, aviso, convite) precisa de uma versão para o WhatsApp, revisada antes de entregar:
- Formatação do WhatsApp: `*negrito*`, `_itálico_`, parágrafos curtos, sem títulos markdown nem tabelas.
- Começa com o gancho, traz o versículo com a referência e termina com o link do site (`https://cafegracaefralda.github.io/#devocional`).
- Confira o link, o nome do Denny e o tom (acolhedor, sem pregação). Mensagens do site (`data-wa` e `waLink`) devem apontar para `5581992702353`.
- O Canal do WhatsApp aceita texto longo, mas o começo precisa convencer a abrir o link.

## Onde está cada coisa
- Seções da página única (o menu rola até elas): Início, 5 minutos (`#devocional`), Café na mesa (`#cafe`), Comunidade (`#comunidade`: chat, comentários, indicações), Sobre (`#sobre`), Painel (`#painel`, só administradores). Links antigos (`#agendar`, `#mesa`, `#indicacoes`...) têm alias em `20-router.js`.
- Devocional da semana: lista `DEVOS` em `js/10-data.js`. Sai um novo toda quarta, na ordem da lista (a partir de 30/09/2026). A lista NÃO se repete: quando acaba, o último fica em destaque. Escreva novos devocionais antes de a lista acabar (hoje são 8).
- Indicações ("Da nossa mesa para a sua"): `INDICACOES`. Itens com `exemplo: true` são placeholders.
- Banco e login: Supabase `https://ckzeechkxghhmoshgzyv.supabase.co`, chave pública no código, login só com Google. Esquema em `_docs/supabase-v2.sql`; passo a passo do login em `_docs/LOGIN-GOOGLE.md`. As regras de segurança (RLS) ficam no banco: nunca confie só no front-end.
- Chat entre pais exige login (mostra só o primeiro nome). Comentários são públicos. Agendar/desmarcar exige login. O painel (`eh_admin()`) só abre para e-mails na tabela `admins`.
- Agendamento: seg a sex, 20h às 22h, slots de 30 min (tabela `horarios_semana`, editável no painel). Formatos: chamada no WhatsApp, vídeo, presencial.
- App: PWA (`manifest.webmanifest`, `sw.js`, `icons/`, `screenshots/`). Pacote de loja: `_docs/APP-LOJA.md`. Cada publicação troca a versão do `sw.js` automaticamente.
- Kit do Instagram e do Canal do WhatsApp: `_kit/AAAA-MM-DD/` (slides 1080×1350, legenda.md) e `_kit/perfil/`.

## Fatos sobre a família (não invente outros)
- Denny Silva, 34 anos. Casado com a Gabi há 7 anos; "10 anos construindo família"; "3 anos criando filhos".
- Gêmeos de 3 anos e um bebê de 3 meses (em out/2026). Não invente nomes, traços ou histórias dos filhos.
- Discipula pessoas desde os 15 anos (19 anos). Trabalha na área comercial, serve na igreja local.
- WhatsApp (81) 99270-2353 · Instagram @denny___silva · perfil do projeto: @cafegracaefralda (a confirmar).

## Tom e linha editorial
- Cristão e sem negociar a fé, mas acolhedor para quem não é da igreja. Profundo na simplicidade, sem jargão de seminário.
- Linguagem de mesa, café e madrugada. Frases curtas. Sem pregação nem tom de vendedor; nada de "mentoria".
- Versículos na NVI, sempre com referência. Oração no fim como convite ("Se quiser, ore assim").
- Nunca chamar o "Café na sua mesa" de terapia; indicar médico ou psicólogo quando o assunto pedir.
- Privacidade: no chat só o primeiro nome. Não peça nem publique nome completo, foto ou escola dos filhos.

## Conversas privadas e SEO
- Conversas privadas: aba "Privado" da Comunidade e botão "Chamar no privado" no chat. Só os dois participantes leem (nem o painel). Tem bloquear, denunciar (WhatsApp do Denny), desligar recebimento e limite de 20 msg/min. Esquema em `_docs/supabase-v3-privado.sql` (rodar uma vez no SQL Editor depois do v2).
- SEO: título/descrição/JSON-LD vêm do `build.py`. Depois de publicar, enviar `https://cafegracaefralda.github.io/sitemap.xml` no Google Search Console (https://search.google.com/search-console). Novo devocional em `DEVOS` ganha página própria sozinho no build.
- Mural das famílias (aba Mural, a primeira da Comunidade): feed com tipos (conversa, indicação, desabafo, pedido de oração, gratidão), foto, curtir, comentar, denunciar. Só para quem entrou (nada público nem indexado). Fotos num bucket privado `mural` (JPEG reduzido no navegador, sem dados de localização, link temporário). 3 denúncias escondem o post; o Denny apaga qualquer um. Esquema em `_docs/supabase-v4-mural.sql` (rodar depois do v2 e v3).
- Indicações dos membros: formulário na aba Indicações (nome, especialidade, assunto, onde fica, como conheceu, plano de saúde ou particular, por que indica, contato). Só logado envia; fica em análise até o Denny aprovar em Painel > Moderação. Esquema em `_docs/supabase-v5-indicacoes.sql`.
