# Café, Graça & Fralda

Site e app (PWA) de Denny Silva: fé e família na vida real. Publicado em https://cafegracaefralda.github.io pelo GitHub Pages (branch `main`, pasta raiz). O Denny pede as mudanças pelo chat; ele não edita código.

## Como mudar e publicar
1. Edite só `_src/page.html` (textos, estilos e scripts da página).
2. Rode `python3 _src/build.py`: gera `index.html` e `sw.js`. Nunca edite esses dois à mão.
3. Teste antes de publicar: abra o `index.html` num navegador headless (Playwright em `/opt/pw-browsers/chromium`) em 1280px e 390px; confira que não há erro de script e que a página não rola para o lado.
4. Commit em português, curto, e `git push origin main`. O GitHub Pages publica em 1 a 2 minutos.
5. Mostre ao Denny o que mudou (print ou resumo) e o link do site.

Mudanças de texto pequenas podem ser publicadas direto. Mudanças de layout, seções novas ou remoções: mostre um print e espere o "ok" dele antes do push.

## Onde está cada coisa
- Devocional da semana: lista `DEVOS` em `_src/page.html`. Um novo sai toda quarta, na ordem da lista (calendário em `devoSchedule`, a partir de 30/09/2026). Para continuar a série, acrescente no fim.
- Indicações ("Da nossa mesa para a sua"): lista `INDICACOES`. Itens com `exemplo: true` são placeholders.
- Agendamento ("Um café na sua mesa"): seg a sex, 20h às 22h, slots de 30 min. `AGENDA_URL` vazio até o Denny ligar o Google Apps Script (`_docs/agenda/`).
- Banco de dados: Supabase `https://ckzeechkxghhmoshgzyv.supabase.co` com chave pública no código. Tabelas e regras em `_docs/supabase-setup.sql`.
- Kit do Instagram e do Canal do WhatsApp: `_kit/AAAA-MM-DD/` (slides 1080×1350, legenda.md) e `_kit/perfil/`.

## Fatos sobre a família (não invente outros)
- Denny Silva, 34 anos. Casado com a Gabi há 7 anos; "10 anos construindo família".
- Gêmeos de 3 anos e um bebê de 3 meses (em out/2026). Não invente nomes, traços ou histórias dos filhos.
- Discipula pessoas desde os 15 anos (19 anos). Trabalha na área comercial, serve na igreja local.
- WhatsApp (81) 99270-2353 · Instagram @denny___silva · perfil do projeto: @cafegracaefralda (a confirmar).

## Tom e linha editorial
- Cristão e sem negociar a fé, mas acolhedor para quem não é da igreja. Profundo na simplicidade, sem jargão de seminário.
- Linguagem de mesa, café e madrugada. Frases curtas. Sem pregação nem tom de vendedor; nada de "mentoria".
- Versículos na NVI, sempre com referência. Oração no fim como convite ("Se quiser, ore assim").
- Nunca chamar o "Café na sua mesa" de terapia; indicar médico ou psicólogo quando o assunto pedir.
