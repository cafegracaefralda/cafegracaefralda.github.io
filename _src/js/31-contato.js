// Primeiro login: a pessoa escolhe o nome que a comunidade vai ver (obrigatório) e, se quiser, deixa o WhatsApp.
// Só a própria pessoa e a administração veem o WhatsApp.
var ct = { checked: "" };
var ctDlg = $("contatoDlg");
$("ct-zap").addEventListener("input", maskPhone);
function normZap(v){
  var d = String(v || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^55[0-9]{10,11}$/.test(d) ? d : "";
}
function googleFirstName(){ return firstName(auth.name()); }
auth.on(function(){
  if (!auth.user || !sb) { ct.checked = ""; if (ctDlg.open) ctDlg.close(); return; }
  if (ct.checked === auth.user.id) return;
  ct.checked = auth.user.id;
  sb.rpc("garantir_perfil").then(function(p){
    if (p.error) { ct.checked = ""; return; }
    var temNome = !!(p.data && p.data.apelido);
    if (temNome) { auth.apelido = p.data.apelido; applyAuthUI(); }
    return sb.from("contatos").select("whatsapp").eq("user_id", auth.user.id).maybeSingle().then(function(r){
      if (r.error) { ct.checked = ""; return; }
      ct.temContato = !!r.data;
      if ((!temNome || !r.data) && !ctDlg.open) {
        ct.temNome = temNome;
        $("ct-nome").value = (p.data && p.data.apelido) || googleFirstName();
        $("ct-zap").value = ""; setStatus($("ctStatus"), "");
        $("ct-nome-box").hidden = temNome;
        ctDlg.showModal();
      }
    });
  });
});
$("ctSave").addEventListener("click", function(){
  var st = $("ctStatus"), nome = val("ct-nome").replace(/\s+/g, " "), raw = $("ct-zap").value.trim(), zap = raw ? normZap(raw) : null;
  if (!ct.temNome && (nome.length < 2 || nome.length > 30)) return setStatus(st, "Escolha um nome com 2 a 30 letras.", "err");
  if (raw && !zap) return setStatus(st, "Informe o WhatsApp com DDD, por exemplo (81) 99999-9999, ou deixe em branco.", "err");
  if (zap && !$("ct-ok").checked) return setStatus(st, "Para salvar o número, aceite o contato da equipe.", "err");
  $("ctSave").disabled = true; setStatus(st, "Salvando…");
  var passos = [];
  if (!ct.temNome) passos.push(sb.from("perfis").update({ apelido: nome }).eq("user_id", auth.user.id));
  if (!ct.temContato) passos.push(sb.from("contatos").upsert({ whatsapp: zap, consentimento: true }, { onConflict: "user_id" }));
  Promise.all(passos).then(function(rs){
    $("ctSave").disabled = false;
    if (rs.some(function(r){ return r.error; })) return setStatus(st, "Não foi possível salvar agora. Tente de novo.", "err");
    setStatus(st, ""); ctDlg.close(); toast("Pronto! Bem-vinda(o) à mesa, " + (ct.temNome ? "" : nome) + ".");
    if (!ct.temNome) { auth.apelido = nome; applyAuthUI(); }
  });
});
