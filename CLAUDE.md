# Café, Graça & Fralda

Site e app (PWA) de Denny Silva: fé e família na vida real. Publicado em https://cafegracaefralda.github.io pelo GitHub Pages (branch `main`, pasta raiz). O Denny pede as mudanças pelo chat; ele não edita código.

## Como mudar e publicar
1. Edite os arquivos de `_src/` (nunca `index.html` nem `sw.js`, que são gerados):
   - `styles.css`: visual. `body.html`: estrutura das telas. `lessons.html`: "O que a gente aprendeu".
   - `js/00-core.js` (utilidades e Supabase) · `10-data.js` (devocionais e indicações) · `20-router.js` (telas) · `30-auth.js` (login Google)
     · `40-devocional.js` · `50-cafe.js` (agendar/desmarcar) · `55-palestra.js` (convite de palestra → WhatsApp) · `60-comunidade.js` (indicações) · `62-mural.js` (Mesa Grande) · `67-prateleira.js` (Prateleira) · `72-stories.js` · `73-lazer.js` · `63-indicar.js` (indicar profissional) · `65-privado.js` (Mensagens: privado em tempo real, com emoji, foto e áudio) · `66-notificacoes.js` (sininho) · `70-painel.js` (painel do Denny) · `80-app.js` (instalar o app).
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
- Site com cara de rede social, tratado como COMUNIDADE (não falar do Denny nos textos públicos; contato é a equipe/WhatsApp). Cada área é uma tela (menu lateral no computador, barra de baixo no celular; foco total no celular: alvos de 44 px, campos de 16 px). Telas: Início (`#inicio`: tagline, botão "Preciso de um profissional da Casa" e as POSTAGENS DA CASA = devocional da semana + publicações oficiais (selo ✓); sem fotos pessoais e sem textos que excluam alguém: voz para todos os públicos, com viés cristão), Prateleira (`#prateleira`: publicações da comunidade com foto, vídeo, PDF, YouTube, link e texto; oficiais com selo; devocionais em `#prateleira/devocional`), Mesa Grande (`#mesa`, só logado: stories de 24 h, publicar livre e `#mesa/lazer` com lazer por cidade/UF), Mensagens (`#mensagens`: privado em tempo real com texto, emoji, foto e áudio), Indicações (`#indicacoes`), Profissionais da Casa (`#casa` e `#palestra`; contato da equipe é o WhatsApp do topo), Painel (`#painel`, só administradores). Links antigos (`#dacasa`, `#devocional`, `#feed`, `#comunidade`, `#privado`, `#lazer`, `#sobre`...) têm alias em `20-router.js`.
- Devocional da semana: lista `DEVOS` em `js/10-data.js`. Sai um novo toda quarta, na ordem da lista (a partir de 30/09/2026). A lista NÃO se repete: quando acaba, o último fica em destaque. Escreva novos devocionais antes de a lista acabar (hoje são 8).
- Indicações ("Da nossa mesa para a sua"): `INDICACOES`. Itens com `exemplo: true` são placeholders.
- Banco e login: Supabase `https://ckzeechkxghhmoshgzyv.supabase.co`, chave pública no código, login só com Google. Esquema em `_docs/supabase-v2.sql`; passo a passo do login em `_docs/LOGIN-GOOGLE.md`. As regras de segurança (RLS) ficam no banco: nunca confie só no front-end.
- Mesa Grande e Mensagens exigem login (mostra só o primeiro nome). Agendar/desmarcar exige login. O painel (`eh_admin()`) só abre para e-mails na tabela `admins`.
- Agendamento: seg a sex, 20h às 22h, slots de 30 min (tabela `horarios_semana`, editável no painel). Formatos: chamada no WhatsApp, vídeo, presencial.
- App: PWA (`manifest.webmanifest`, `sw.js`, `icons/`, `screenshots/`). Pacote de loja: `_docs/APP-LOJA.md`. Cada publicação troca a versão do `sw.js` automaticamente.
- Kit do Instagram e do Canal do WhatsApp: `_kit/AAAA-MM-DD/` (slides 1080×1350, legenda.md) e `_kit/perfil/`.

## Fatos sobre a família (não invente outros)
- Denny Silva, 34 anos. Casado com a Gabi há 7 anos; "10 anos construindo família"; "3 anos criando filhos".
- Gêmeos de 3 anos e um bebê de 3 meses (em out/2026). Não invente nomes, traços ou histórias dos filhos.
- Discipula pessoas desde os 15 anos (19 anos). Trabalha na área comercial, serve na igreja local.
- WhatsApp (81) 99270-2353 · Instagram @denny___silva · perfil do projeto: @cafegracaefralda (a confirmar).

## Tom e linha editorial
- O site é para TODOS os públicos, com viés cristão e sem excluir ninguém (ver Início). Fotos pessoais do Denny e da família não entram no site.
- Cristão e sem negociar a fé, mas acolhedor para quem não é da igreja. Profundo na simplicidade, sem jargão de seminário.
- Linguagem de mesa, café e madrugada. Frases curtas. Sem pregação nem tom de vendedor; nada de "mentoria".
- Versículos na NVI, sempre com referência. Oração no fim como convite ("Se quiser, ore assim").
- Nunca chamar o "Café na sua mesa" de terapia; indicar médico ou psicólogo quando o assunto pedir.
- Privacidade: no chat só o primeiro nome. Não peça nem publique nome completo, foto ou escola dos filhos.

## Conversas privadas e SEO
- Mensagens privadas (tela Mensagens, em tempo real) e botão "Chamar no privado" nos posts da Mesa Grande, mais "Quem está na mesa" e busca por nome. Só os dois participantes leem (nem o painel). Tem bloquear, denunciar (WhatsApp do Denny), desligar recebimento e limite de 20 msg/min. Esquema em `_docs/supabase-v3-privado.sql` (rodar uma vez no SQL Editor depois do v2).
- SEO: título/descrição/JSON-LD vêm do `build.py`. Depois de publicar, enviar `https://cafegracaefralda.github.io/sitemap.xml` no Google Search Console (https://search.google.com/search-console). Novo devocional em `DEVOS` ganha página própria sozinho no build.
- Mesa Grande (menu Mesa Grande, `#mesa`): feed com tipos (conversa, indicação, desabafo, pedido de oração, gratidão), foto, curtir, comentar, denunciar. Só para quem entrou (nada público nem indexado). Fotos num bucket privado `mural` (JPEG reduzido no navegador, sem dados de localização, link temporário). 3 denúncias escondem o post; o Denny apaga qualquer um. Esquema em `_docs/supabase-v4-mural.sql` (rodar depois do v2 e v3).
- Indicações dos membros: formulário na aba Indicações (nome, especialidade, assunto, onde fica, como conheceu, plano de saúde ou particular, por que indica, contato). Só logado envia; fica em análise até o Denny aprovar em Painel > Moderação. Esquema em `_docs/supabase-v5-indicacoes.sql`.
- Notificações (sininho no topo): avisa comentário, curtida e mensagem privada; criadas por gatilhos no banco. Arquivos no privado: foto e áudio até 5 MB, bucket privado `privado`. Esquema em `_docs/supabase-v6-notificacoes.sql` (rodar depois do v2, v3 e v4; também liga o tempo real). Aviso do navegador só funciona com o site aberto; push com o app fechado exigiria servidor extra (não feito).
- Prateleira: tabela `pubs` (oficial só para administrador, via gatilho), bucket público `prateleira` (JPEG, PDF, MP4/WebM até 30 MB). Leitura aberta; publicar/curtir/comentar exige login; 3 denúncias escondem (menos as oficiais). Esquema em `_docs/supabase-v7-prateleira.sql`. Stories (24 h) e Lazer em  família (cidade+UF obrigatórios): `_docs/supabase-v8-stories-lazer.sql`.
- Ordem dos SQLs no Supabase: v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13 (v13 = menções @nome; v12 = Ofertas, alertas e banimento; v11 = perfil pessoal; v10 = áudio na Prateleira, vídeo só da administração e novas categorias de Indicações).
- Profissionais da Casa (`#casa`): perfis com selo ✓ (pessoas de confiança da comunidade), todos no MESMO formato; só muda o segmento (`saude` ou `fe`). Dados em `PROS` (`js/10-data.js`); no celular a tela Mensagens tem lista e conversa em tela cheia; para acrescentar alguém, copie um bloco e só preencha o que for real (whatsapp, site, instagram). Hoje: Denny Silva (aconselhamento pastoral e familiar), Dra. Larissa Moraes (obstetra) e Dr. Fred Hanaoka (pediatra). O agendamento "Café na mesa" foi removido. A obstetra e o pediatra também estão em `INDICACOES` com selo.

- Entrada obrigatória: o site cobre tudo com a tela de boas-vindas (`#loginWall`) até a pessoa entrar (Google ou link por e-mail; o link por e-mail exige o provedor Email ligado no Supabase). No 1º login aparece `#contatoDlg` pedindo o WhatsApp (OPCIONAL, com aceite; "Agora não" grava sem número). Dados em `contatos` (`_docs/supabase-v9-contatos.sql`): só a pessoa e o painel (aba Membros, RPC `membros_contatos`) veem. Código: `30-auth.js`, `31-contato.js`.
- Parcerias: link "Anuncie / Seja um Profissional da Casa" no rodapé e em `#casa` abre `#partnerDlg` (`57-parceiro.js`); o pedido sai pronto no WhatsApp da equipe. Não há preços no site.

- Nomes de casa (menu): A Casa (`#inicio`, devocional da semana + posts oficiais), Prateleira (materiais: PDF, áudio, vídeo só da Casa, link, foto), Mesa Grande (conversa e stories), Quintal (`#lazer`, lazer em família), Mensagens (título "Conversa de quarto"), Vizinhança (`#indicacoes`: profissionais, hotéis, restaurantes, praças...) e Profissionais da Casa. A aba "5 minutos" foi removida (o devocional vive em A Casa). Parcerias/anúncio foram retirados por enquanto.

- Perfil pessoal (`#perfil` = o meu, `#perfil/<id>` = de outra pessoa; `32-perfil.js`): foto (bucket `mural`), nome na comunidade, cidade, bio e as publicações da pessoa (Mesa, Prateleira, Quintal). No 1º login `#contatoDlg` pede o NOME que a comunidade vai ver (obrigatório, 2 a 30 letras) e o WhatsApp opcional. O nome escolhido fica em `perfis.apelido` e a função SQL `primeiro_nome()` passa a usá-lo em tudo que for publicado depois (`_docs/supabase-v11-perfil.sql`). Quem entra sem endereço cai direto na Mesa Grande (rede social); antes de entrar, a tela `#loginWall` apresenta a comunidade e as áreas.
- Ofertas de parceiros (A Casa > aba Ofertas, `58-ofertas.js`): anunciante pede (pendente), a equipe combina valores por WhatsApp e ativa no Painel > Anunciantes. Oferta de anunciante novo é revisada (Painel > Ofertas); "confiável" publica direto. Link `https://`, etiqueta "Anúncio", validade até 60 dias, produtos que fazem mal à saúde são recusados pelo banco (`texto_proibido`). `_docs/supabase-v12-ofertas-moderacao.sql`.
- Alertas e banimento (Painel > Alertas): palavrão leve publica e avisa; ofensa grave esconde (comentário é mascarado) e avisa; ações Ignorar/Advertir/Apagar/Banir (`alerta_resolver`). Mensagens privadas NÃO são lidas. Menções `@nome` (`33-mencoes.js`, `_docs/supabase-v13-mencoes.sql`) notificam pelo sininho.
- SQL único para a extensão: `_docs/supabase-TUDO-v6-a-v13.sql`. "Prateleira" saiu do menu (só administradores veem "Publicar na Casa").
