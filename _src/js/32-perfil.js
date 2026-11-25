// Perfil pessoal (estilo Instagram): nome escolhido, foto, cidade, bio e tudo o que a pessoa publicou.
function nameLink(texto, userId){
  var a = h("a", "name-link", texto); a.href = "#perfil/" + (userId === uid() ? "" : userId); a.style.fontWeight = "700"; a.style.color = "inherit"; a.style.fontSize = "inherit"; a.style.textDecoration = "none"; return a;
}
var pf = { id: "", data: null, tok: 0, file: null };
function pfTarget(){ var s = (location.hash || "").replace(/^#\/?/, "").split("/"); return s[0] === "perfil" && s[1] ? s[1] : uid(); }
function pfFillAvatar(el, nome, url){
  el.innerHTML = ""; el.style.backgroundImage = "";
  if (url) { el.style.backgroundImage = 'url("' + url + '")'; el.classList.add("has-img"); } else { el.classList.remove("has-img"); el.textContent = initial(nome); }
}
function pfSign(path){ return path ? sb.storage.from("mural").createSignedUrl(path, 3600).then(function(r){ return r.data ? r.data.signedUrl : ""; }) : Promise.resolve(""); }
function pfTile(emoji, rotulo, texto, quando, destino){
  var a = h("a", "pf-tile"); a.href = destino;
  a.append(h("span", "pf-kind", emoji + " " + rotulo), h("p", null, texto ? texto.slice(0, 120) : "(sem texto)"), h("small", null, ago(quando)));
  return a;
}
function loadPerfil(){
  if (!sb || !auth.user) return;
  var id = pfTarget(), tok = ++pf.tok; pf.id = id;
  var mine = id === uid();
  $("pfNome").textContent = "Carregando…"; $("pfGrid").innerHTML = ""; $("pfStats").textContent = "";
  $("pfEdit").hidden = !mine; $("pfMsg").hidden = mine; $("pfShare").hidden = !mine;
  Promise.all([
    sb.from("perfis").select("user_id,nome,apelido,bio,cidade,avatar").eq("user_id", id).maybeSingle(),
    sb.from("posts").select("id,tipo,texto,criado_em").eq("user_id", id).order("criado_em", { ascending: false }).limit(30),
    sb.from("pubs").select("id,tipo,titulo,texto,criado_em,oficial").eq("user_id", id).eq("oficial", false).order("criado_em", { ascending: false }).limit(30),
    sb.from("lazer").select("id,nome_local,cidade,uf,porque,criado_em").eq("user_id", id).order("criado_em", { ascending: false }).limit(30)
  ]).then(function(rs){
    if (tok !== pf.tok) return;
    var p = rs[0].data;
    if (!p) { $("pfNome").textContent = "Perfil não encontrado"; return; }
    pf.data = p;
    var nome = p.apelido || p.nome || "Visitante";
    $("pfNome").textContent = nome;
    $("pfCidade").hidden = !p.cidade; $("pfCidade").textContent = p.cidade ? "📍 " + p.cidade : "";
    $("pfBio").hidden = !p.bio; $("pfBio").textContent = p.bio || "";
    pfFillAvatar($("pfAv"), nome, "");
    pfSign(p.avatar).then(function(u){ if (tok === pf.tid || tok === pf.tok) pfFillAvatar($("pfAv"), nome, u); });
    var itens = [];
    (rs[1].data || []).forEach(function(x){ itens.push({ t: x.criado_em, el: pfTile("☕", "Mesa Grande", x.texto, x.criado_em, "#mesa") }); });
    (rs[2].data || []).forEach(function(x){ itens.push({ t: x.criado_em, el: pfTile("📚", (TIPO_PUB[x.tipo] || "Prateleira").replace(/^\S+\s/, ""), x.titulo || x.texto, x.criado_em, "#prateleira") }); });
    (rs[3].data || []).forEach(function(x){ itens.push({ t: x.criado_em, el: pfTile("🌳", "Quintal", x.nome_local + " · " + x.cidade + "/" + x.uf, x.criado_em, "#lazer") }); });
    itens.sort(function(a, b){ return a.t < b.t ? 1 : -1; });
    $("pfStats").innerHTML = ""; var n = h("span", null); n.append(h("b", null, String(itens.length)), document.createTextNode(itens.length === 1 ? " publicação" : " publicações")); $("pfStats").appendChild(n);
    if (!itens.length) { var e = h("div", "empty card"); e.append(h("h3", null, mine ? "Você ainda não publicou" : "Ainda sem publicações"), h("p", null, mine ? "Tudo o que você postar na Mesa, na Prateleira e no Quintal aparece aqui." : "")); $("pfGrid").appendChild(e); }
    itens.forEach(function(i){ $("pfGrid").appendChild(i.el); });
  });
}
viewHooks.perfil = function(){ if (auth.user) loadPerfil(); };
window.addEventListener("hashchange", function(){ if (isShown("perfil")) viewHooks.perfil(); });
auth.on(function(){ if (auth.user && isShown("perfil")) loadPerfil(); });

$("pfMsg").addEventListener("click", function(){ if (pf.data) { go("mensagens"); openDm(pf.id, pf.data.apelido || pf.data.nome); } });
$("pfEdit").addEventListener("click", function(){
  var p = pf.data || {}; pf.file = null;
  $("pf-nome").value = p.apelido || p.nome || ""; $("pf-cidade").value = p.cidade || ""; $("pf-bio").value = p.bio || "";
  pfFillAvatar($("pfEditAv"), p.apelido || p.nome, ""); pfSign(p.avatar).then(function(u){ if (!pf.file) pfFillAvatar($("pfEditAv"), p.apelido || p.nome, u); });
  setStatus($("pfStatus"), ""); $("pfDlg").showModal();
});
$("pfDlgClose").addEventListener("click", function(){ $("pfDlg").close(); });
$("pfFoto").addEventListener("change", function(){
  var f = this.files && this.files[0]; this.value = ""; if (!f) return;
  shrinkPhoto(f).then(function(blob){ pf.file = blob; pfFillAvatar($("pfEditAv"), "", URL.createObjectURL(blob)); }, function(){ toast("Não consegui usar essa foto."); });
});
$("pfSave").addEventListener("click", function(){
  var st = $("pfStatus"), nome = val("pf-nome").replace(/\s+/g, " ");
  if (nome.length < 2 || nome.length > 30) return setStatus(st, "Escolha um nome com 2 a 30 letras.", "err");
  $("pfSave").disabled = true; setStatus(st, "Salvando…");
  var path = pf.file ? uid() + "/avatar-" + newUuid() + ".jpg" : null;
  var up = path ? sb.storage.from("mural").upload(path, pf.file, { contentType: "image/jpeg", upsert: false }) : Promise.resolve({});
  up.then(function(u){
    if (u && u.error) throw new Error("foto");
    var row = { apelido: nome, cidade: val("pf-cidade") || null, bio: val("pf-bio") || null }; if (path) row.avatar = path;
    return sb.from("perfis").update(row).eq("user_id", uid()).then(function(r){ if (r.error) throw new Error("salvar"); });
  }).then(function(){
    $("pfSave").disabled = false; $("pfDlg").close(); auth.apelido = nome; applyAuthUI(); avForget(uid()); toast("Perfil salvo."); loadPerfil();
  }).catch(function(err){ $("pfSave").disabled = false; setStatus(st, err.message === "foto" ? "Não foi possível enviar a foto." : "Não foi possível salvar agora. Tente de novo.", "err"); });
});

$("pfShare").addEventListener("click", function(){
  var url = location.origin + location.pathname + "#perfil/" + uid();
  var txt = "Venha me conhecer na comunidade Café, Graça & Fralda: " + url;
  window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank", "noopener");
});
