"""Monta o site publicado (index.html, sw.js) a partir dos arquivos de _src/.

Uso:  python3 _src/build.py
Fontes: styles.css, body.html, lessons.html, logo-symbol.svg e js/*.js (em ordem alfabética).
O resultado é um index.html único (CSS e JS embutidos) mais o service worker, que faz o site funcionar como app.
"""
import hashlib
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "_src"
BASE_URL = "https://cafegracaefralda.github.io/"
TITLE = "Café, Graça & Fralda"
DESCRIPTION = "Fé e família na vida real, com Denny Silva. Um devocional de 5 minutos toda quarta, chat entre pais e um café na sua mesa."


def read(path):
    return (SRC / path).read_text(encoding="utf-8")


css = read("styles.css")
body = read("body.html").replace("{{LOGO_SYMBOL}}", read("logo-symbol.svg")).replace("{{LESSONS}}", read("lessons.html"))
js = "\n\n".join(p.read_text(encoding="utf-8") for p in sorted((SRC / "js").glob("*.js")))

html = f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{TITLE.replace("&", "&amp;")}</title>
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
<meta property="og:site_name" content="{TITLE.replace("&", "&amp;")}">
<meta property="og:title" content="{TITLE.replace("&", "&amp;")} · Entre o café e a fralda, tem graça.">
<meta property="og:description" content="{DESCRIPTION}">
<meta property="og:url" content="{BASE_URL}">
<meta property="og:image" content="{BASE_URL}icons/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap">
<style>
{css}
</style>
</head>
<body>
{body}
<script src="vendor/supabase.js"></script>
<script>
(function(){{
"use strict";
{js}
}})();
if ("serviceWorker" in navigator) {{
  window.addEventListener("load", function(){{ navigator.serviceWorker.register("sw.js").catch(function(){{}}); }});
}}
</script>
</body>
</html>
"""
(ROOT / "index.html").write_text(html, encoding="utf-8")

version = hashlib.sha1(html.encode("utf-8")).hexdigest()[:10]
sw = read("sw.template.js").replace("__VERSION__", version)
(ROOT / "sw.js").write_text(sw, encoding="utf-8")
print(f"index.html ({len(html) // 1024} KB) e sw.js gerados (versão {version})")
