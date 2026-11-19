# Levar o app para a Google Play e a App Store

O site já é um aplicativo (PWA): instala na tela inicial, abre em tela cheia, tem barra de abas
no celular e abre até sem internet. Para aparecer nas lojas, ele precisa ser empacotado.
O empacotamento exige as contas e a chave de assinatura do Denny, por isso é feito por ele.

## Android (Google Play)
Custo: US$ 25, uma vez só. Uns 30 minutos, mais o prazo de aprovação do Google.
1. Crie a conta em https://play.google.com/console/signup (conta pessoal; o Google pede um documento).
2. Abra https://www.pwabuilder.com, cole `https://cafegracaefralda.github.io` e clique em **Start**.
3. Em **Package for stores → Android → Google Play**, deixe o nome **Café, Graça & Fralda**,
   o ID do pacote `io.github.cafegracaefralda` e gere o pacote. Guarde o arquivo da chave de assinatura que ele baixar.
4. Para o app abrir sem barra de endereço, o PWABuilder entrega um trecho `assetlinks.json`.
   Mande esse trecho para o Claude: ele publica em `.well-known/assetlinks.json` no site.
5. Envie o arquivo `.aab` na Play Console. Contas novas precisam de um teste fechado com 12 pessoas por 14 dias antes de publicar.
- O login com Google funciona nesse tipo de app (Trusted Web Activity) porque roda no Chrome.

## iPhone (App Store)
Custo: US$ 99 por ano (conta Apple Developer) e um Mac com Xcode, ou um serviço de empacotamento de terceiros.
A Apple recusa apps que são só um site dentro de um app. Para passar, o app precisa de algo nativo,
como notificação no celular toda quarta com o devocional. Isso é um trabalho à parte.
Até lá, no iPhone o app se instala pelo Safari: Compartilhar → Adicionar à Tela de Início.

## Teste rápido do app instalado
- Android/Chrome: menu ⋮ → Instalar app (ou o botão "Instalar o app" em Sobre).
- Abra no modo avião: o site abre com a última versão salva.
