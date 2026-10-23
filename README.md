# Café, Graça & Fralda

Site e aplicativo (PWA) de Denny Silva: fé e família na vida real.

## Como o projeto está organizado
- `index.html`, `sw.js`: o site publicado. **Não edite à mão**; são gerados pelo montador.
- `_src/page.html`: a página em si (textos, estilos e funcionamento).
- `_src/build.py`: monta o site final. Rode `python3 _src/build.py` depois de mudar a página.
- `manifest.webmanifest` e `icons/`: o que faz o site virar aplicativo no celular.
- `img/`: fotos da família.
- `_docs/`: guias para ligar a Agenda do Google (`agenda/`) e o banco de dados Supabase (`supabase-setup.sql`).

## Publicação
O site é publicado pelo GitHub Pages a partir da branch `main`.
