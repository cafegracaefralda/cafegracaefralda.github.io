-- Café, Graça & Fralda · banco v16: stories voltam a durar 24 horas (e não ficam guardados) + 5 postagens oficiais do livro "Entre a Fralda e a Bíblia".
-- Como usar: Supabase > SQL Editor > cole tudo > Run. Pode rodar mais de uma vez (não duplica as postagens). Não apaga dados de ninguém.
--
-- Stories: depois de 24 horas ninguém mais vê. O dono ainda "enxerga" o vencido só para o site apagar a foto e o registro (sem histórico).
drop policy if exists "stories: ler" on public.stories;
create policy "stories: ler" on public.stories for select to authenticated using (criado_em > now() - interval '24 hours' or user_id = auth.uid());

-- Remove do banco os stories vencidos sempre que alguém publica um novo (as fotos são apagadas pelo site quando o dono volta).
create or replace function public.limpar_stories_vencidos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.stories where criado_em < now() - interval '24 hours';
  return new;
end $$;
drop trigger if exists zz_limpar_stories_t on public.stories;
create trigger zz_limpar_stories_t after insert on public.stories for each statement execute function public.limpar_stories_vencidos();

-- Postagens oficiais (aparecem em A Casa, com o selo, e a comunidade pode curtir e comentar).
-- Entram em nome do primeiro administrador cadastrado. Os gatilhos ficam desligados só durante a inserção.
alter table public.pubs disable trigger user;
insert into public.pubs (user_id, autor, oficial, tipo, titulo, texto, fixado, aprovado, criado_em)
select (select u.id from auth.users u join public.admins a on lower(a.email) = lower(u.email) order by u.created_at limit 1),
  'Café, Graça & Fralda', true, 'devocional', 'Deus cria. Os pais formam. Somente Deus salva.', 'Se a Bíblia não funcionar na terça-feira (na hora do banho, no trânsito travado ou diante do prato de brócolis rejeitado), ela não funciona no domingo. E a boa notícia é que ela funciona.

Deus cria. Os pais formam. Somente Deus salva.

Quem entende a primeira respeita o filho como obra única de Deus. Quem entende a segunda assume a responsabilidade diária de ensinar e corrigir sem terceirizar. Quem entende a terceira consegue encostar a cabeça no travesseiro e dormir em paz.

Do livro "Entre a Fralda e a Bíblia".', false, true, now() - interval '7 minutes'
where exists (select 1 from auth.users u join public.admins a on lower(a.email) = lower(u.email))
  and not exists (select 1 from public.pubs where oficial and titulo = 'Deus cria. Os pais formam. Somente Deus salva.');
insert into public.pubs (user_id, autor, oficial, tipo, titulo, texto, fixado, aprovado, criado_em)
select (select u.id from auth.users u join public.admins a on lower(a.email) = lower(u.email) order by u.created_at limit 1),
  'Café, Graça & Fralda', true, 'devocional', 'O "nada" nunca é nada.', 'Quando seu filho chorar "do nada", a frustração de sentir algo grande por dentro e não ter palavras para explicar costuma virar grito.

Antes da bronca, passe por três perguntas:

1. Ele está com fome, sono ou cansaço?
2. Está tentando me comunicar algo que não sabe dizer?
3. Precisa de colo antes de precisar de regra?

Primeiro acolha o sentimento. Depois ajude a pensar e firme o limite.

Do livro "Entre a Fralda e a Bíblia".', false, true, now() - interval '14 minutes'
where exists (select 1 from auth.users u join public.admins a on lower(a.email) = lower(u.email))
  and not exists (select 1 from public.pubs where oficial and titulo = 'O "nada" nunca é nada.');
insert into public.pubs (user_id, autor, oficial, tipo, titulo, texto, fixado, aprovado, criado_em)
select (select u.id from auth.users u join public.admins a on lower(a.email) = lower(u.email) order by u.created_at limit 1),
  'Café, Graça & Fralda', true, 'devocional', 'Seu filho não é um adulto pequeno.', 'Quando estamos cansados, cobramos maturidade executiva de quem acabou de sair das fraldas: "Você já tem três anos, já devia saber!"

Mas o freio do cérebro ainda está amadurecendo. Isso não é maldade: é um "eu" aprendendo a existir dentro de limites seguros.

Um passo para hoje: escolha uma situação em que você se frustra (hora de dormir, guardar brinquedos, esperar a vez), divida em passos pequenos e avise antes da transição. A previsibilidade diminui a ansiedade.

Do livro "Entre a Fralda e a Bíblia".', false, true, now() - interval '21 minutes'
where exists (select 1 from auth.users u join public.admins a on lower(a.email) = lower(u.email))
  and not exists (select 1 from public.pubs where oficial and titulo = 'Seu filho não é um adulto pequeno.');
insert into public.pubs (user_id, autor, oficial, tipo, titulo, texto, fixado, aprovado, criado_em)
select (select u.id from auth.users u join public.admins a on lower(a.email) = lower(u.email) order by u.created_at limit 1),
  'Café, Graça & Fralda', true, 'devocional', 'Parar um comportamento à força é fácil.', 'Parar um comportamento à força é fácil. Formar o coração exige diálogo.

Quando a correção vira luta física, o cérebro da criança fica preso no modo de defesa e não reflete sobre nada.

Um termômetro para hoje, antes de dormir: "Minha última correção produziu medo, conformidade mecânica ou compreensão?" Se foi só medo, amanhã comece pedindo perdão e conversando de novo.

Do livro "Entre a Fralda e a Bíblia".', false, true, now() - interval '28 minutes'
where exists (select 1 from auth.users u join public.admins a on lower(a.email) = lower(u.email))
  and not exists (select 1 from public.pubs where oficial and titulo = 'Parar um comportamento à força é fácil.');
insert into public.pubs (user_id, autor, oficial, tipo, titulo, texto, fixado, aprovado, criado_em)
select (select u.id from auth.users u join public.admins a on lower(a.email) = lower(u.email) order by u.created_at limit 1),
  'Café, Graça & Fralda', true, 'devocional', 'Disciplina é reforma de casa, não demolição.', 'Corrigir demais costuma ensinar de menos.

A regra das duas frases: respire fundo e use, no máximo, duas frases curtas. Uma sobre o fato ("Você jogou o brinquedo") e outra sobre a reparação ("Vamos pegar e guardar").

Quando o erro gera reparação, a criança aprende. Quando só gera humilhação, ela aprende a esconder.

Do livro "Entre a Fralda e a Bíblia".', false, true, now() - interval '35 minutes'
where exists (select 1 from auth.users u join public.admins a on lower(a.email) = lower(u.email))
  and not exists (select 1 from public.pubs where oficial and titulo = 'Disciplina é reforma de casa, não demolição.');
alter table public.pubs enable trigger user;

-- Anunciantes: campo "o que quer anunciar" e aviso dentro do site quando a conta é ativada ou recusada.
alter table public.anunciantes add column if not exists sobre text check (sobre is null or char_length(sobre) <= 300);
grant insert (sobre) on public.anunciantes to authenticated;
grant update (sobre) on public.anunciantes to authenticated;

alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo in ('comentario', 'curtida', 'dm', 'pub_comentario', 'pub_curtida', 'alerta', 'aviso', 'mencao', 'pedido'));

create or replace function public.notif_status_anunciante()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('ativo', 'recusado', 'suspenso') then
    insert into public.notificacoes (user_id, tipo, de_nome, resumo) values (new.user_id, 'aviso', 'Administração',
      case new.status when 'ativo' then 'Sua conta de parceiro foi ativada. Já dá para publicar ofertas em A Casa > Ofertas.'
                      when 'recusado' then 'Seu pedido para anunciar não foi aprovado agora.' else 'Sua conta de parceiro foi suspensa.' end);
  end if;
  return new;
end $$;
drop trigger if exists notif_status_anunciante_t on public.anunciantes;
create trigger notif_status_anunciante_t after update on public.anunciantes for each row execute function public.notif_status_anunciante();

-- Avisa TODOS os membros no sininho sempre que A Casa (conta oficial) publicar algo.
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo in ('comentario', 'curtida', 'dm', 'pub_comentario', 'pub_curtida', 'alerta', 'aviso', 'mencao', 'pedido', 'casa'));

create or replace function public.notif_casa_publicacao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.oficial and new.aprovado then
    insert into public.notificacoes (user_id, tipo, de_nome, pub_id, resumo)
    select p.user_id, 'casa', 'Café, Graça & Fralda', new.id, left(coalesce(nullif(new.titulo, ''), new.texto), 120)
    from public.perfis p where p.user_id <> new.user_id;
  end if;
  return new;
end $$;
drop trigger if exists zz_notif_casa_t on public.pubs;
create trigger zz_notif_casa_t after insert on public.pubs for each row execute function public.notif_casa_publicacao();
