# Café, Graça & Fralda

Site e aplicativo (PWA) de Denny Silva: fé e família na vida real.

## Como o projeto está organizado
- `index.html`, `sw.js`: o site publicado. **Não edite à mão**; são gerados pelo montador.
- `_src/`: o código-fonte (`styles.css`, `body.html`, `lessons.html`, `js/*.js`) e o montador `build.py`.
  Rode `python3 _src/build.py` depois de mudar algo.
- `vendor/supabase.js`: biblioteca do Supabase (login e banco), copiada para funcionar offline.
- `manifest.webmanifest`, `icons/`, `screenshots/`: o que faz o site virar aplicativo.
- `img/`: fotos da família.
- `_docs/`: guias e SQL (`supabase-v2.sql`, `LOGIN-GOOGLE.md`, `APP-LOJA.md`).
- `_kit/`: artes e textos para Instagram e Canal do WhatsApp.

## Publicação
O site é publicado pelo GitHub Pages a partir da branch `main`.
Antes de publicar a versão com login: rodar `_docs/supabase-v2.sql` e ligar o Google (veja `_docs/LOGIN-GOOGLE.md`).
