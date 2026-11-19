// Núcleo: configuração, utilidades e conexão com o Supabase.
var WA = "5581992702353";
var SUPABASE_URL = "https://ckzeechkxghhmoshgzyv.supabase.co";
var SUPABASE_KEY = "sb_publishable_h_dmTjHQHfyA0FyFXqePYg_I3RJvt0k"; // chave pública: pode ficar no site

function $(id){ return document.getElementById(id); }
function $$(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function h(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function val(id){ return $(id).value.trim(); }
function setStatus(el, msg, kind){ el.textContent = msg; el.className = "status" + (kind ? " " + kind : ""); }
function waLink(text, number){ return "https://wa.me/" + (number || WA) + (text ? "?text=" + encodeURIComponent(text) : ""); }
function lsGet(k){ try { return localStorage.getItem(k) || ""; } catch(e){ return ""; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
function firstName(full){ return String(full || "").trim().split(/\s+/)[0] || ""; }
function initial(name){ return (String(name || "?").trim().charAt(0) || "?").toUpperCase(); }
function icon(id){ var s = document.createElementNS("http://www.w3.org/2000/svg", "svg"), u = document.createElementNS("http://www.w3.org/2000/svg", "use"); u.setAttribute("href", "#" + id); s.appendChild(u); return s; }
function maskPhone(e){
  var d = e.target.value.replace(/\D/g, "").slice(0, 11);
  e.target.value = d.length > 6 ? "(" + d.slice(0,2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(-4) : d.length > 2 ? "(" + d.slice(0,2) + ") " + d.slice(2) : d;
}
var fmtDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
var rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
function ago(iso){
  var d = new Date(iso); if (isNaN(d)) return "";
  var s = (d - Date.now()) / 1000, a = Math.abs(s);
  if (a < 60) return "agora";
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (a < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  return fmtDate.format(d).replace(".", "");
}
function toast(msg){
  var t = $("toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(function(){ t.hidden = true; }, 2600);
}
function copyText(text, okMsg){
  function fallback(){ toast("Não foi possível copiar. Selecione e copie manualmente."); }
  try { navigator.clipboard.writeText(text).then(function(){ toast(okMsg || "Copiado"); }, fallback); } catch(e){ fallback(); }
}

// Horário de Brasília e datas no formato AAAA-MM-DD
function nowBR(){ return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })); }
function isoDay(d){ return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function parseDay(s){ var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
function isoWeekday(d){ return d.getDay() === 0 ? 7 : d.getDay(); }
var WEEKDAYS = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
var fmtLong = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

// Links do WhatsApp com mensagem pronta
$$("[data-wa]").forEach(function(a){ a.href = waLink(a.getAttribute("data-wa")); });

// Supabase: login com Google e banco de dados. Se a biblioteca não carregar, o site segue funcionando pelo WhatsApp.
var sb = null;
try {
  if (window.supabase) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
  });
} catch(e){ sb = null; }
function errCode(err){
  var m = String((err && (err.message || err.details || err.code)) || "");
  var codes = ["login_necessario","horario_ocupado","horario_indisponivel","horario_passado","limite_agendamentos","dados_invalidos","nao_encontrado"];
  for (var i = 0; i < codes.length; i++) if (m.indexOf(codes[i]) > -1) return codes[i];
  return "";
}
