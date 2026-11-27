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
  $("pfEdit").hidden = !mine; $("pfMsg").hidden = mine; $("pfShare").hidden = !mine; $("pfFollow").hidden = mine; pfSeguidores(id, mine);
  Promise.all([
    sb.from("perfis").select("user_id,nome,apelido,bio,cidade,avatar,link").eq("user_id", id).maybeSingle().then(function(r){ return r.error ? sb.from("perfis").select("user_id,nome,apelido,bio,cidade,avatar").eq("user_id", id).maybeSingle() : r; }),
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
    var lk = /^https?:\/\//i.test(p.link || "") ? p.link : ""; $("pfLink").hidden = !lk;
    if (lk) { $("pfLinkA").href = lk; $("pfLinkA").textContent = "🔗 " + lk.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "").slice(0, 40); }
    pfFillAvatar($("pfAv"), nome, "");
    pfSign(p.avatar).then(function(u){ if (tok === pf.tid || tok === pf.tok) pfFillAvatar($("pfAv"), nome, u); });
    var itens = [];
    (rs[1].data || []).forEach(function(x){ itens.push({ t: x.criado_em, el: pfTile("☕", "Mesa", x.texto, x.criado_em, "#mesa") }); });
    (rs[2].data || []).forEach(function(x){ itens.push({ t: x.criado_em, el: pfTile("📚", (TIPO_PUB[x.tipo] || "Prateleira").replace(/^\S+\s/, ""), x.titulo || x.texto, x.criado_em, "#prateleira") }); });
    (rs[3].data || []).forEach(function(x){ itens.push({ t: x.criado_em, el: pfTile("🌳", "Quintal", x.nome_local + " · " + x.cidade + "/" + x.uf, x.criado_em, "#lazer") }); });
    itens.sort(function(a, b){ return a.t < b.t ? 1 : -1; });
    pfSeg.nPub = itens.length; pfPintaSeg();
    if (!itens.length) { var e = h("div", "empty card"); e.append(h("h3", null, mine ? "Você ainda não publicou" : "Ainda sem publicações"), h("p", null, mine ? "Tudo o que você postar na Mesa aparece aqui." : "")); $("pfGrid").appendChild(e); }
    itens.forEach(function(i){ $("pfGrid").appendChild(i.el); });
  });
}
viewHooks.perfil = function(){ if (auth.user) loadPerfil(); };
window.addEventListener("hashchange", function(){ if (isShown("perfil")) viewHooks.perfil(); });
auth.on(function(){ if (auth.user && isShown("perfil")) loadPerfil(); });

$("pfMsg").addEventListener("click", function(){ if (pf.data) { go("mensagens"); openDm(pf.id, pf.data.apelido || pf.data.nome); } });
$("pfEdit").addEventListener("click", function(){
  var p = pf.data || {}; pf.file = null;
  $("pf-nome").value = p.apelido || p.nome || ""; $("pf-cidade").value = p.cidade || ""; $("pf-bio").value = p.bio || ""; $("pf-link").value = p.link || "";
  pfFillAvatar($("pfEditAv"), p.apelido || p.nome, ""); pfSign(p.avatar).then(function(u){ if (!pf.file) pfFillAvatar($("pfEditAv"), p.apelido || p.nome, u); });
  setStatus($("pfStatus"), ""); $("pfDlg").showModal();
});
$("pfDlgClose").addEventListener("click", function(){ $("pfDlg").close(); });
$("pfFoto").addEventListener("change", function(){
  var f = this.files && this.files[0]; this.value = ""; if (!f) return;
  shrinkPhoto(f).then(function(blob){ pf.file = blob; pfFillAvatar($("pfEditAv"), "", URL.createObjectURL(blob)); }, function(e){ if (e && e.message === "nsfw") return; toast("Não consegui usar essa foto."); });
});
$("pfSave").addEventListener("click", function(){
  var st = $("pfStatus"), nome = val("pf-nome").replace(/\s+/g, " ");
  if (nome.length < 2 || nome.length > 30) return setStatus(st, "Escolha um nome com 2 a 30 letras.", "err");
  $("pfSave").disabled = true; setStatus(st, "Salvando…");
  var path = pf.file ? uid() + "/avatar-" + newUuid() + ".jpg" : null;
  var up = path ? sb.storage.from("mural").upload(path, pf.file, { contentType: "image/jpeg", upsert: false }) : Promise.resolve({});
  up.then(function(u){
    if (u && u.error) throw new Error("foto");
    var lkv = val("pf-link"); if (lkv && !/^https?:\/\//i.test(lkv)) lkv = "https://" + lkv;
    if (lkv && !/^https?:\/\/[^\s]+\.[^\s]+$/.test(lkv)) throw new Error("link");
    var row = { apelido: nome, cidade: val("pf-cidade") || null, bio: val("pf-bio") || null, link: lkv || null }; if (path) row.avatar = path;
    return sb.from("perfis").update(row).eq("user_id", uid()).then(function(r){ if (r.error) throw new Error("salvar"); });
  }).then(function(){
    $("pfSave").disabled = false; $("pfDlg").close(); auth.apelido = nome; applyAuthUI(); avForget(uid()); toast("Perfil salvo."); loadPerfil();
  }).catch(function(err){ $("pfSave").disabled = false; setStatus(st, err.message === "link" ? "Esse link não parece certo. Confira o endereço." : err.message === "foto" ? "Não foi possível enviar a foto." : "Não foi possível salvar agora. Tente de novo.", "err"); });
});

$("pfShare").addEventListener("click", function(){
  var url = location.origin + location.pathname + "#perfil/" + uid();
  var txt = "Venha me conhecer na comunidade Café, Graça & Fralda: " + url;
  window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank", "noopener");
});

// Seguir: contagens e botão
var pfSeg = { id: "", segue: false };
function pfSeguidores(id, mine){
  pfSeg.id = id;
  Promise.all([
    sb.from("seguidores").select("seguidor", { count: "exact", head: true }).eq("seguido", id),
    sb.from("seguidores").select("seguido", { count: "exact", head: true }).eq("seguidor", id),
    mine ? Promise.resolve({ data: [] }) : sb.from("seguidores").select("seguido").eq("seguidor", uid()).eq("seguido", id)
  ]).then(function(r){
    if (pfSeg.id !== id) return;
    pfSeg.segue = !!(r[2].data && r[2].data.length); pfSeg.nSeg = r[0].count || 0; pfSeg.nSig = r[1].count || 0;
    setTimeout(pfPintaSeg, 400);
  });
}
function pfPintaSeg(){
  var st = $("pfStats"); st.innerHTML = "";
  [["nPub", "publicações", null], ["nSeg", "seguidores", "seguidores"], ["nSig", "seguindo", "seguindo"]].forEach(function(c){
    var b = h(c[2] ? "button" : "span", "pf-num"); if (c[2]) { b.type = "button"; b.addEventListener("click", function(){ pfAbrirLista(c[2]); }); }
    b.append(h("b", null, String(pfSeg[c[0]] || 0)), h("small", null, c[1])); st.appendChild(b);
  });
  $("pfFollow").textContent = pfSeg.segue ? "Seguindo" : "Seguir"; $("pfFollow").classList.toggle("btn-ghost", pfSeg.segue); $("pfFollow").classList.toggle("btn-terra", !pfSeg.segue);
}
$("pfFollow").addEventListener("click", function(){
  var id = pfSeg.id; if (!id || id === uid()) return; $("pfFollow").disabled = true;
  var q = pfSeg.segue ? sb.from("seguidores").delete().eq("seguidor", uid()).eq("seguido", id) : sb.from("seguidores").insert({ seguido: id });
  q.then(function(r){ $("pfFollow").disabled = false; if (r.error) return toast("Não foi possível agora."); pfSeg.segue = !pfSeg.segue; pfSeg.nSeg = (pfSeg.nSeg || 0) + (pfSeg.segue ? 1 : -1); pfPintaSeg(); });
});

// Lista de seguidores / de quem a pessoa segue
function pfAbrirLista(tipo){
  var id = pfSeg.id; if (!id) return;
  var seguidores = tipo === "seguidores";
  $("pfListTitle").textContent = seguidores ? "Seguidores" : "Seguindo"; var box = $("pfListBox"); box.innerHTML = ""; box.appendChild(h("p", "hint", "Carregando…")); $("pfListDlg").showModal();
  sb.from("seguidores").select(seguidores ? "seguidor" : "seguido").eq(seguidores ? "seguido" : "seguidor", id).limit(200).then(function(r){
    var ids = (r.data || []).map(function(x){ return seguidores ? x.seguidor : x.seguido; });
    box.innerHTML = "";
    if (!ids.length) { box.appendChild(h("p", "hint", seguidores ? "Ainda sem seguidores." : "Ainda não segue ninguém.")); return; }
    return sb.from("perfis").select("user_id,nome,apelido").in("user_id", ids).then(function(p){
      (p.data || []).forEach(function(x){
        var nome = x.apelido || x.nome || "Alguém", b = h("button", "side-person"); b.type = "button";
        var tx = h("span"); tx.append(h("b", null, nome), h("small", null, "Ver perfil")); b.append(avSpan(x.user_id, nome), tx);
        b.addEventListener("click", function(){ $("pfListDlg").close(); go("perfil" + (x.user_id === uid() ? "" : "/" + x.user_id)); });
        box.appendChild(b);
      });
    });
  });
}
$("pfListClose").addEventListener("click", function(){ $("pfListDlg").close(); });
