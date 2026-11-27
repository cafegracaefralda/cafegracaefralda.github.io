// Sininho: avisa quando alguém comenta, curte um post seu ou manda mensagem privada.
var notif = { items: [], unread: 0, seenIds: {}, first: true, timer: null };
var bellBtn = $("bellBtn"), bellPanel = $("bellPanel");

function notifText(n){
  if (n.tipo === "comentario") return [n.de_nome + " comentou", n.resumo ? "“" + n.resumo + "”" : "no seu post"];
  if (n.tipo === "curtida") return [n.de_nome + " curtiu o seu post", ""];
  if (n.tipo === "pub_comentario") return [n.de_nome + " comentou na Casa", n.resumo ? "“" + n.resumo + "”" : ""];
  if (n.tipo === "pub_curtida") return [n.de_nome + " curtiu a sua publicação", ""];
  if (n.tipo === "seguir") return [n.de_nome + " começou a seguir você", ""];
  if (n.tipo === "story_curtida") return [n.de_nome + " curtiu o seu story", ""];
  if (n.tipo === "casa") return ["📣 Novidade da Casa", n.resumo || ""];
  if (n.tipo === "pedido") return ["🤝 Parceria", n.resumo];
  if (n.tipo === "mencao") return [n.de_nome + " mencionou você", n.resumo ? "“" + n.resumo + "”" : ""];
  if (n.tipo === "alerta") return ["⚠️ Alerta de linguagem", n.de_nome + ": " + n.resumo];
  if (n.tipo === "aviso") return ["Aviso da administração", n.resumo];
  return [n.de_nome + " te mandou uma mensagem", n.resumo ? "“" + n.resumo + "”" : ""];
}
function setBell(){
  var el = $("bellN"); el.textContent = notif.unread > 9 ? "9+" : String(notif.unread); el.hidden = !notif.unread;
  bellBtn.classList.toggle("on", !!notif.unread);
}
function renderBell(){
  var box = $("bellList"); box.innerHTML = "";
  if (!notif.items.length) { var e = h("p", "bell-empty", "Sem novidades por enquanto."); box.appendChild(e); return; }
  notif.items.forEach(function(n){
    var t = notifText(n), b = h("button", "bell-item" + (n.lida ? "" : " new")); b.type = "button";
    var tx = h("span", "bi-tx"); tx.append(h("b", null, t[0]), t[1] ? h("small", null, t[1]) : document.createTextNode(""), h("time", null, ago(n.criado_em)));
    b.append(h("span", "avatar", initial(n.de_nome)), tx);
    b.addEventListener("click", function(){ openNotif(n); });
    box.appendChild(b);
  });
}
function loadNotifs(){
  if (!sb || !auth.user) return;
  sb.from("notificacoes").select("id,tipo,de_nome,post_id,pub_id,conversa_id,resumo,lida,criado_em").order("criado_em", { ascending: false }).limit(30).then(function(r){
    if (!r.data) return;
    var fresh = r.data.filter(function(n){ return !n.lida && !notif.seenIds[n.id]; });
    r.data.forEach(function(n){ notif.seenIds[n.id] = true; });
    notif.items = r.data; notif.unread = r.data.filter(function(n){ return !n.lida; }).length;
    setBell(); renderBell();
    if (!notif.first && fresh.length) browserNotify(fresh[0], fresh.length);
    notif.first = false;
  });
}
function browserNotify(n, count){
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    var t = notifText(n), titulo = n.tipo === "casa" ? "📣 Novidade da Casa" : n.tipo === "mencao" ? "Você foi mencionado(a)" : "Café, Graça & Fralda";
    var corpo = count > 1 ? count + " novidades na comunidade" : (n.tipo === "casa" || n.tipo === "mencao" ? (t[1] || t[0]) : t[0] + (t[1] ? ": " + t[1] : ""));
    var opt = { body: corpo, icon: "icons/icon-192.png", badge: "icons/favicon-32.png", tag: "cgf-" + (count > 1 ? "varios" : n.id), data: { url: "./" + (n.tipo === "casa" ? "#inicio" : "#mesa") } };
    // No celular só o service worker consegue mostrar o aviso na tela
    if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistration().then(function(reg){ if (reg && reg.showNotification) reg.showNotification(titulo, opt); else new Notification(titulo, opt); }).catch(function(){ new Notification(titulo, opt); });
    else new Notification(titulo, opt);
  } catch(e){}
}
function markRead(ids){
  if (!ids.length || !sb) return Promise.resolve();
  return sb.from("notificacoes").update({ lida: true }).in("id", ids).then(function(){
    notif.items.forEach(function(n){ if (ids.indexOf(n.id) > -1) n.lida = true; });
    notif.unread = notif.items.filter(function(n){ return !n.lida; }).length; setBell(); renderBell();
  });
}
function setPanel(open){ bellPanel.hidden = !open; bellBtn.setAttribute("aria-expanded", open); if (open) { renderBell(); loadNotifs(); pushBtn(); } }
function pushBtn(){ $("bellPush").hidden = !("Notification" in window) || Notification.permission !== "default"; }
function openNotif(n){
  setPanel(false);
  markRead([n.id]);
  if (n.tipo === "casa") { go("inicio"); home.focus = n.pub_id; loadHome(true); }
  else if (n.tipo === "pedido") { go("painel", /^Oferta/.test(n.resumo) ? "ofertas" : "anunciantes"); }
  else if (n.tipo === "alerta") { go("painel", "alertas"); }
  else if (n.tipo === "dm" && n.conversa_id) {
    go("mensagens");
    loadConvs().then(function(){ openConv(n.conversa_id); });
  } else if (n.pub_id) {
    pub.focus = n.pub_id; home.focus = n.pub_id; if (n.tipo === "pub_comentario") pub.open[n.pub_id] = true;
    go("inicio"); loadHome(true);
  } else if (n.post_id) {
    feed.focus = n.post_id; if (n.tipo === "comentario") feed.open[n.post_id] = true;
    go("mesa"); loadFeed(true);
  }
}
bellBtn.addEventListener("click", function(e){ e.stopPropagation(); setPanel(bellPanel.hidden); });
document.addEventListener("click", function(e){ if (!bellPanel.hidden && !bellPanel.contains(e.target) && e.target !== bellBtn) setPanel(false); });
$("bellAll").addEventListener("click", function(){ markRead(notif.items.filter(function(n){ return !n.lida; }).map(function(n){ return n.id; })); });
$("bellPush").addEventListener("click", function(){
  try { Notification.requestPermission().then(function(p){ pushBtn(); toast(p === "granted" ? "Avisos ligados. Vou te avisar quando o site estiver aberto em segundo plano." : "Sem problema. Os avisos continuam no sininho."); }); } catch(e){}
});

var nChannel = null;
function subNotifRealtime(){
  if (nChannel || !sb || !auth.user || !sb.channel) return;
  try { nChannel = sb.channel("notif-" + auth.user.id).on("postgres_changes", { event: "INSERT", schema: "public", table: "notificacoes" }, function(){ loadNotifs(); }).subscribe(); } catch(e){ nChannel = null; }
}
auth.on(function(){
  if (!auth.user || !sb) { try { if (nChannel && sb) sb.removeChannel(nChannel); } catch(e){} nChannel = null; notif = { items: [], unread: 0, seenIds: {}, first: true, timer: notif.timer }; setBell(); return; }
  subNotifRealtime();
  if (!notif.timer) {
    loadNotifs();
    notif.timer = setInterval(function(){ if (!document.hidden || ("Notification" in window && Notification.permission === "granted")) loadNotifs(); }, 30000);
  }
});

// Convite para ligar os avisos do celular (Casa e menções): aparece uma vez por visita até a pessoa decidir
var pedidoAviso = false;
auth.on(function(){
  if (!auth.user || pedidoAviso || !("Notification" in window) || Notification.permission !== "default") return;
  pedidoAviso = true;
  setTimeout(function(){
    if (Notification.permission !== "default" || !auth.user) return;
    var bar = h("div", "aviso-bar"); bar.append(h("span", null, "🔔 Receber avisos da Casa e quando te mencionarem?"));
    var yes = h("button", "btn btn-terra btn-sm", "Ativar"), no = h("button", "link", "Agora não"); yes.type = no.type = "button";
    yes.addEventListener("click", function(){ bar.remove(); try { Notification.requestPermission().then(function(r){ pushBtn(); if (r === "granted") toast("Avisos ligados."); }); } catch(e){} });
    no.addEventListener("click", function(){ bar.remove(); });
    bar.append(yes, no); document.body.appendChild(bar);
  }, 4000);
});
