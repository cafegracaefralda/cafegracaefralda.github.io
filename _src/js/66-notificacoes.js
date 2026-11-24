// Sininho: avisa quando alguém comenta, curte um post seu ou manda mensagem privada.
var notif = { items: [], unread: 0, seenIds: {}, first: true, timer: null };
var bellBtn = $("bellBtn"), bellPanel = $("bellPanel");

function notifText(n){
  if (n.tipo === "comentario") return [n.de_nome + " comentou", n.resumo ? "“" + n.resumo + "”" : "no seu post"];
  if (n.tipo === "curtida") return [n.de_nome + " curtiu o seu post", ""];
  return [n.de_nome + " te mandou uma mensagem", n.resumo ? "“" + n.resumo + "”" : ""];
}
function setBell(){
  var el = $("bellN"); el.textContent = notif.unread > 9 ? "9+" : String(notif.unread); el.hidden = !notif.unread;
  bellBtn.classList.toggle("on", !!notif.unread);
}
function renderBell(){
  var box = $("bellList"); box.innerHTML = "";
  if (!notif.items.length) { var e = h("p", "bell-empty", "Nada por aqui ainda. Quando alguém comentar, curtir ou te chamar no privado, aparece aqui."); box.appendChild(e); return; }
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
  sb.from("notificacoes").select("id,tipo,de_nome,post_id,conversa_id,resumo,lida,criado_em").order("criado_em", { ascending: false }).limit(30).then(function(r){
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
    if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
    var t = notifText(n);
    new Notification("Café, Graça & Fralda", { body: count > 1 ? count + " novidades na mesa" : t[0] + (t[1] ? ": " + t[1] : ""), icon: "icons/icon-192.png", tag: "cgf" });
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
  if (n.tipo === "dm" && n.conversa_id) {
    go("comunidade", "privado");
    loadConvs().then(function(){ openConv(n.conversa_id); });
  } else if (n.post_id) {
    feed.focus = n.post_id; if (n.tipo === "comentario") feed.open[n.post_id] = true;
    go("feed"); loadFeed(true);
  }
}
bellBtn.addEventListener("click", function(e){ e.stopPropagation(); setPanel(bellPanel.hidden); });
document.addEventListener("click", function(e){ if (!bellPanel.hidden && !bellPanel.contains(e.target) && e.target !== bellBtn) setPanel(false); });
$("bellAll").addEventListener("click", function(){ markRead(notif.items.filter(function(n){ return !n.lida; }).map(function(n){ return n.id; })); });
$("bellPush").addEventListener("click", function(){
  try { Notification.requestPermission().then(function(p){ pushBtn(); toast(p === "granted" ? "Avisos ligados. Vou te avisar quando o site estiver aberto em segundo plano." : "Sem problema. Os avisos continuam no sininho."); }); } catch(e){}
});

auth.on(function(){
  if (!auth.user || !sb) { notif = { items: [], unread: 0, seenIds: {}, first: true, timer: notif.timer }; setBell(); return; }
  if (!notif.timer) {
    loadNotifs();
    notif.timer = setInterval(function(){ if (!document.hidden || ("Notification" in window && Notification.permission === "granted")) loadNotifs(); }, 30000);
  }
});
