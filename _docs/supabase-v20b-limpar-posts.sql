-- Café, Graça & Fralda · LIMPEZA ÚNICA: apaga TODOS os posts do site (Mesa Grande e A Casa), com comentários, curtidas e denúncias,
-- e os avisos do sininho e alertas ligados a eles. Para inaugurar o site do zero.
-- ATENÇÃO: não tem volta. Rode UMA vez, só quando quiser começar limpo. Não apaga pessoas, perfis, mensagens privadas, stories nem indicações.
delete from public.posts;
delete from public.pubs;
delete from public.notificacoes where tipo in ('comentario', 'curtida', 'pub_comentario', 'pub_curtida', 'casa', 'mencao');
delete from public.alertas where origem in ('posts', 'post_comentarios', 'pubs', 'pub_comentarios');
select (select count(*) from public.posts) as posts, (select count(*) from public.pubs) as pubs;
