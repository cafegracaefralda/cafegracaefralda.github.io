// WhatsApp de quem entra: pedido no primeiro login, com aceite. Só a própria pessoa e a administração veem.
var ct = { checked: "" };
var ctDlg = $("contatoDlg");
$("ct-zap").addEventListener("input", maskPhone);
function normZap(v){
  var d = String(v || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^55[0-9]{10,11}$/.test(d) ? d : "";
}
auth.on(function(){
  if (!auth.user || !sb) { ct.checked = ""; if (ctDlg.open) ctDlg.close(); return; }
  if (ct.checked === auth.user.id) return;
  ct.checked = auth.user.id;
  sb.from("contatos").select("whatsapp").eq("user_id", auth.user.id).maybeSingle().then(function(r){
    if (r.error) { ct.checked = ""; return; }
    if (!r.data && !ctDlg.open) { $("ct-zap").value = ""; setStatus($("ctStatus"), ""); ctDlg.showModal(); }
  });
});
$("ctSave").addEventListener("click", function(){
  var st = $("ctStatus"), raw = $("ct-zap").value.trim(), zap = normZap(raw);
  if (!raw) return saveContato(null);
  if (!zap) return setStatus(st, "Informe o WhatsApp com DDD, por exemplo (81) 99999-9999, ou toque em Agora não.", "err");
  if (!$("ct-ok").checked) return setStatus(st, "Para salvar o número, aceite o contato da equipe.", "err");
  saveContato(zap);
});
function saveContato(zap){
  var st = $("ctStatus");
  $("ctSave").disabled = true; setStatus(st, "Salvando…");
  sb.from("contatos").upsert({ whatsapp: zap, consentimento: true }, { onConflict: "user_id" }).then(function(r){
    $("ctSave").disabled = false;
    if (r.error) return setStatus(st, "Não foi possível salvar agora. Tente de novo.", "err");
    setStatus(st, ""); ctDlg.close(); toast("Pronto! Bem-vindo à mesa.");
  });
}
$("ctSkip").addEventListener("click", function(){ saveContato(null); });
