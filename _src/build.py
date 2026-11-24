"""Monta o site publicado a partir dos arquivos de _src/.

Uso:  python3 _src/build.py   (precisa do Node.js para ler a lista de devocionais)
Gera: index.html, sw.js, sitemap.xml, robots.txt e uma página própria para cada devocional
      (devocional/<slug>/index.html), para o Google indexar cada texto.
"""
import hashlib
import html
import json
import pathlib
import re
import subprocess
import unicodedata
from datetime import date, datetime, timedelta

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "_src"
BASE_URL = "https://cafegracaefralda.github.io/"
TITLE = "Café, Graça & Fralda"
HOME_TITLE = "Café, Graça & Fralda | Devocional de 5 minutos para pais e famílias"
DESCRIPTION = ("Comunidade de famílias de todo o Brasil: devocional de 5 minutos toda quarta, conversas privadas entre pais, "
               "Mesa Grande com stories, lazer em família por cidade, indicações de confiança e fé na vida real.")
KEYWORDS = "devocional para pais, devocional família, paternidade cristã, maternidade cristã, casamento cristão, criar filhos na fé, devocional de 5 minutos, comunidade de famílias, lazer em família"
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500'
         '&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap">')
MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
WA = "5581992702353"


def read(path):
    return (SRC / path).read_text(encoding="utf-8")


def quote_verse(t):
    import re
    s = t.replace("“", "‘")
    s = re.sub(r"”\.?$", ".’", s)
    s = s.replace("”", "’")
    return "“" + s + "”"


def esc(t):
    return html.escape(str(t), quote=True)


def slugify(t):
    t = unicodedata.normalize("NFD", str(t))
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", t))


def load_devos():
    """Lê DEVOS e FIRST_RELEASE do arquivo de dados do site (JavaScript) usando o Node."""
    code = (
        "const vm=require('vm'),fs=require('fs');const c={};vm.createContext(c);"
        "vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';this.out=JSON.stringify({devos:DEVOS,y:FIRST_RELEASE.getFullYear(),m:FIRST_RELEASE.getMonth(),d:FIRST_RELEASE.getDate()})',c);"
        "console.log(c.out)"
    )
    out = subprocess.run(["node", "-e", code, str(SRC / "js" / "10-data.js")], check=True, capture_output=True, text=True).stdout
    data = json.loads(out)
    first = date(data["y"], data["m"] + 1, data["d"])
    return data["devos"], first


def pt_date(d):
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}"


devos, FIRST = load_devos()
for i, d in enumerate(devos):
    d["slug"] = slugify(d["title"])
    d["date"] = FIRST + timedelta(days=7 * i)
today = date.today()

css = read("styles.css")
symbol = read("logo-symbol.svg")
body = read("body.html").replace("{{LOGO_SYMBOL}}", symbol).replace("{{LESSONS}}", read("lessons.html"))
js = "\n\n".join(p.read_text(encoding="utf-8") for p in sorted((SRC / "js").glob("*.js")))

graph = {
    "@context": "https://schema.org",
    "@graph": [
        {"@type": "WebSite", "@id": BASE_URL + "#site", "url": BASE_URL, "name": TITLE, "inLanguage": "pt-BR",
         "description": DESCRIPTION, "publisher": {"@id": BASE_URL + "#org"}},
        {"@type": "Organization", "@id": BASE_URL + "#org", "name": TITLE, "url": BASE_URL,
         "description": "Comunidade de famílias de todo o Brasil: fé e família na vida real."},
    ],
}

home = f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{esc(HOME_TITLE)}</title>
<meta name="description" content="{esc(DESCRIPTION)}">
<meta name="keywords" content="{esc(KEYWORDS)}">
<meta name="author" content="Café, Graça &amp; Fralda">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
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
<meta property="og:site_name" content="{esc(TITLE)}">
<meta property="og:title" content="{esc(TITLE)} · Entre o café e a fralda, tem graça.">
<meta property="og:description" content="{esc(DESCRIPTION)}">
<meta property="og:url" content="{BASE_URL}">
<meta property="og:image" content="{BASE_URL}icons/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Uma família sorrindo, com a frase: Entre o café e a fralda, tem graça.">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{json.dumps(graph, ensure_ascii=False)}</script>
{FONTS}
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
(ROOT / "index.html").write_text(home, encoding="utf-8")

# ---------- uma página para cada devocional ----------
PAGE_CSS = """
:root{--bg:#F8F5F0;--surface:#fff;--sand:#F1ECE5;--ink:#1D1A17;--muted:#6E655C;--terra:#B65B3A;--line:#E7E0D7;--wa:#25D366;
--serif:"Cormorant Garamond","Iowan Old Style",Georgia,serif;--sans:"Plus Jakarta Sans","Segoe UI",system-ui,sans-serif;--mono:"DM Mono",ui-monospace,monospace}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:17px;line-height:1.7;-webkit-font-smoothing:antialiased}
a{color:inherit}.top{border-bottom:1px solid var(--line);background:var(--bg)}
.top .in{max-width:1000px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.logo{display:flex;align-items:center;gap:12px;text-decoration:none;font-family:var(--serif);font-size:24px;font-weight:600}
.mark{width:46px;height:46px;border-radius:50%;background:var(--ink);color:var(--bg);display:grid;place-items:center}.mark svg{width:31px;height:31px}
.back{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;color:var(--muted)}
main{max-width:720px;margin:0 auto;padding:44px 20px 70px}
.label{font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--terra);margin:0}
h1{font-family:var(--serif);font-weight:500;font-size:clamp(38px,6vw,58px);line-height:1.04;margin:10px 0 14px;letter-spacing:-.01em}
.lede{font-size:19px;color:var(--muted);margin:0 0 26px}
.verse{background:var(--sand);border-radius:14px;padding:20px 22px;margin:8px 0 24px;font-family:var(--serif);font-style:italic;font-size:22px;line-height:1.4}
.verse cite{display:block;margin-top:10px;font-family:var(--mono);font-style:normal;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--terra)}
article p{margin:0 0 18px}.box{border:1px solid var(--line);background:var(--surface);border-radius:14px;padding:16px 18px;margin:0 0 14px}.box p{margin:6px 0 0;color:var(--muted)}
.pray{font-family:var(--serif);font-style:italic;font-size:22px;line-height:1.4;margin:8px 0 26px}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0 30px}
.btn{display:inline-flex;align-items:center;font-weight:600;font-size:14px;text-decoration:none;padding:12px 20px;border-radius:999px;border:1px solid var(--ink)}
.btn.wa{background:var(--wa);border-color:var(--wa);color:#0B2E18}.btn.dark{background:var(--ink);color:var(--bg)}
.sig{font-family:var(--serif);font-style:italic;font-size:24px}
.more{border-top:1px solid var(--line);margin-top:34px;padding-top:22px}.more ul{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:8px}
.more a{text-decoration:none;font-family:var(--serif);font-size:22px}.more a:hover{color:var(--terra)}
footer{border-top:1px solid var(--line);padding:18px 20px;text-align:center;font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
"""


def devo_page(i, d):
    url = f"{BASE_URL}devocional/{d['slug']}/"
    iso = d["date"].isoformat()
    share = (f"☕ *{d['title']}*\n_Devocional de 5 minutos · Café, Graça & Fralda_\n\n{quote_verse(d['passage'][0])}\n— {d['passage'][1]}\n\nLeia completo, com oração: {url}")
    article = {
        "@context": "https://schema.org", "@type": "Article", "headline": d["title"], "description": d["lede"],
        "inLanguage": "pt-BR", "datePublished": iso, "dateModified": iso, "mainEntityOfPage": url,
        "image": BASE_URL + "icons/og-image.jpg", "articleSection": d["cat"],
        "author": {"@type": "Organization", "name": TITLE, "url": BASE_URL},
        "publisher": {"@type": "Organization", "name": TITLE, "url": BASE_URL, "logo": {"@type": "ImageObject", "url": BASE_URL + "icons/icon-512.png"}},
    }
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": TITLE, "item": BASE_URL},
        {"@type": "ListItem", "position": 2, "name": "Devocional de 5 minutos", "item": BASE_URL + "#inicio"},
        {"@type": "ListItem", "position": 3, "name": d["title"], "item": url}]}
    paras = "\n".join(f"<p>{esc(t)}</p>" for t in d["body"])
    others = "\n".join(f'<li><a href="/devocional/{o["slug"]}/">{esc(o["title"])}</a></li>' for j, o in enumerate(devos) if j != i)
    title = f"{d['title']} | Devocional de 5 minutos · {TITLE}"
    return f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(d['lede'])}">
<meta name="author" content="Café, Graça &amp; Fralda">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="{url}">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
<meta name="theme-color" content="#F8F5F0">
<meta property="og:type" content="article">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="{esc(TITLE)}">
<meta property="og:title" content="{esc(d['title'])}">
<meta property="og:description" content="{esc(d['lede'])}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{BASE_URL}icons/og-image.jpg">
<meta property="article:published_time" content="{iso}">
<meta property="article:author" content="Café, Graça &amp; Fralda">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{json.dumps(article, ensure_ascii=False)}</script>
<script type="application/ld+json">{json.dumps(crumbs, ensure_ascii=False)}</script>
{FONTS}
<style>{PAGE_CSS}</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">{symbol}</svg>
<header class="top"><div class="in">
  <a class="logo" href="/" aria-label="Café, Graça &amp; Fralda, início"><span class="mark"><svg><use href="#logo"/></svg></span><span>Café, Graça <span style="color:var(--terra)">&amp;</span> Fralda</span></a>
  <a class="back" href="/#inicio">← Voltar para A Casa</a>
</div></header>
<main>
<article>
  <p class="label">Devocional de 5 minutos · {esc(d['cat'])} · <time datetime="{iso}">{pt_date(d['date'])}</time></p>
  <h1>{esc(d['title'])}</h1>
  <p class="lede">{esc(d['lede'])}</p>
  <p class="label">O que a Bíblia diz sobre isso</p>
  <blockquote class="verse">{esc(quote_verse(d['passage'][0]))}<cite>{esc(d['passage'][1])}</cite></blockquote>
  {paras}
  <div class="box"><p class="label">Para pensar</p><p>{esc(d['think'])}</p></div>
  <div class="box"><p class="label">Para hoje</p><p>{esc(d['today'])}</p></div>
  <p class="label" style="margin-top:22px">Se quiser, ore assim</p>
  <p class="pray">{esc(d['prayer'])}</p>
  <div class="actions">
    <a class="btn wa" href="https://wa.me/?text={urlquote(share)}" rel="noopener">Compartilhar no WhatsApp</a>
    <a class="btn" href="https://wa.me/{WA}?text={urlquote('Oi! Li o devocional ' + chr(34) + d['title'] + chr(34) + ' e queria conversar: ')}" rel="noopener">Conversar com a equipe</a>
    <a class="btn dark" href="/#mesa">Conversar na Mesa Grande</a>
  </div>
  <p class="sig">Café, Graça &amp; Fralda</p>
</article>
<aside class="more"><p class="label">Outros devocionais</p><ul>
{others}
</ul></aside>
</main>
<footer>© {today.year} Café, Graça &amp; Fralda</footer>
</body>
</html>
"""


from urllib.parse import quote as urlquote  # noqa: E402

out_dir = ROOT / "devocional"
for i, d in enumerate(devos):
    page_dir = out_dir / d["slug"]
    page_dir.mkdir(parents=True, exist_ok=True)
    (page_dir / "index.html").write_text(devo_page(i, d), encoding="utf-8")

# ---------- sitemap e robots ----------
urls = [(BASE_URL, today.isoformat(), "1.0")]
urls += [(f"{BASE_URL}devocional/{d['slug']}/", d["date"].isoformat(), "0.8") for d in devos if d["date"] <= today]
sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
    f"  <url><loc>{u}</loc><lastmod>{m}</lastmod><priority>{p}</priority></url>\n" for u, m, p in urls) + "</urlset>\n"
(ROOT / "sitemap.xml").write_text(sitemap, encoding="utf-8")
(ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {BASE_URL}sitemap.xml\n", encoding="utf-8")

version = hashlib.sha1(home.encode("utf-8")).hexdigest()[:10]
sw = read("sw.template.js").replace("__VERSION__", version)
(ROOT / "sw.js").write_text(sw, encoding="utf-8")
print(f"index.html ({len(home) // 1024} KB), {len(devos)} páginas de devocional, sitemap com {len(urls)} endereços, sw.js (versão {version})")
