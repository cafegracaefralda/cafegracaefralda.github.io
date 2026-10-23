# Ligar o "Um café na sua mesa" à sua Agenda do Google

Leva uns 10 minutos e é gratuito. Faça pelo computador, logado na conta Google da agenda que vai receber os cafés.

## 1. Criar o projeto
1. Abra **https://script.google.com** e clique em **Novo projeto**.
2. Clique em "Projeto sem título", lá em cima, e dê o nome **Café na sua mesa**.
3. Apague todo o código que aparece e cole o conteúdo do arquivo **Codigo.gs**.
4. Clique no ícone de disquete para **Salvar**.

## 2. Ligar a Agenda (para o link do Google Meet)
1. Na barra da esquerda, ao lado de **Serviços**, clique no **+**.
2. Escolha **Google Calendar API** e clique em **Adicionar**.

## 3. Autorizar e testar o aviso
1. No topo, escolha a função **testarAviso** e clique em **Executar**.
2. O Google pede autorização. Clique em **Revisar permissões**, escolha sua conta.
3. Se aparecer "O Google não verificou este app", clique em **Avançado** e depois em **Acessar Café na sua mesa (não seguro)**. É normal: o app é seu e só você usa.
4. Clique em **Permitir**. Em seguida chega um e-mail de teste na sua caixa.

## 4. Publicar
1. Clique em **Implantar → Nova implantação**.
2. Na engrenagem, escolha **App da Web**.
3. Em **Executar como**, deixe **Eu**. Em **Quem pode acessar**, escolha **Qualquer pessoa**.
4. Clique em **Implantar** e copie o **URL do app da Web** (termina em `/exec`).
5. Abra esse link no navegador. Se aparecer algo como `{"ocupados":[...]}`, está funcionando.

## 5. Ligar ao site
Mande o link para o Claude, ou cole no `index.html`, na linha:

```js
var AGENDA_URL = "";
```

## Para receber o aviso no celular
Instale o app do **Gmail** e deixe as notificações ligadas. Cada café marcado chega como e-mail com o assunto **"☕ Novo café marcado"**.

## Se mudar o código depois
Use **Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão → Implantar**. Assim o link continua o mesmo.
