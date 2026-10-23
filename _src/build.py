"""Monta o site publicado (index.html, sw.js) a partir de _src/page.html.

Uso:  python3 _src/build.py
A página em _src/page.html é a mesma usada na prévia do Claude. Este script coloca o
cabeçalho completo (ícones, prévia do WhatsApp, manifesto do app) e o service worker.
"""
import hashlib
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE_URL = "https://dennydjsilva-stack.github.io/cafe-graca-fralda/"
TITLE = "Café, Graça & Fralda"
DESCRIPTION = "Fé e família na vida real, com Denny Silva. Um devocional de 5 minutos toda quarta, conversa entre pais e um café na sua mesa."

page = (ROOT / "_src" / "page.html").read_text(encoding="utf-8")
split = page.index("</style>") + len("</style>")
head_part, body_part = page[:split], page[split:]
head_part = re.sub(r'<meta name="claude:viewport-fit-sides"[^>]*>\n?', "", head_part)
head_part = re.sub(r'<meta name="description"[^>]*>\n?', "", head_part)

head = f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="{DESCRIPTION}">
<link rel="canonical" href="{BASE_URL}">
<meta name="theme-color" content="#F8F5F0">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Café, Graça &amp; Fralda">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="{TITLE}">
<meta property="og:title" content="{TITLE} · Família de verdade. Fé de verdade.">
<meta property="og:description" content="{DESCRIPTION}">
<meta property="og:url" content="{BASE_URL}">
<meta property="og:image" content="{BASE_URL}icons/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<style>:root{{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0}}</style>
{head_part}
</head>
<body>"""

register_sw = """
<script>
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function(){ navigator.serviceWorker.register("sw.js").catch(function(){}); });
}
</script>
</body>
</html>
"""

html = head + body_part.rstrip() + "\n" + register_sw
(ROOT / "index.html").write_text(html, encoding="utf-8")

version = hashlib.sha1(html.encode("utf-8")).hexdigest()[:10]
sw = (ROOT / "_src" / "sw.template.js").read_text(encoding="utf-8").replace("__VERSION__", version)
(ROOT / "sw.js").write_text(sw, encoding="utf-8")
print(f"index.html e sw.js gerados (versão {version})")
