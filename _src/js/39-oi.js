// Saudação personalizada em A Casa (muda conforme a hora e usa só o primeiro nome)
function homeOi(){
  var n = auth.user ? firstName(auth.name()) : "", hr = new Date().getHours(), t = hr < 5 ? "Boa madrugada" : hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite";
  $("homeOi").textContent = t + (n ? ", " + n : "") + " ☕";
}
auth.on(homeOi); homeOi();
