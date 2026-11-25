-- Café, Graça & Fralda · banco v13: menções (@nome) em posts e comentários, com notificação para a pessoa mencionada.
-- Como usar: Supabase > SQL Editor > cole tudo > Run (depois do v11). Pode rodar mais de uma vez. Não apaga dados.
-- Quem escreve "@Nome" (o nome que a pessoa escolheu no perfil) avisa essa pessoa pelo sininho. Não avisa a si mesma.

alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo in ('comentario', 'curtida', 'dm', 'pub_comentario', 'pub_curtida', 'alerta', 'aviso', 'mencao'));

create or replace function public.notif_mencao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  j jsonb := to_jsonb(new); txt text := coalesce(j ->> 'texto', ''); autor uuid := (j ->> 'user_id')::uuid;
  de text := coalesce(nullif(j ->> 'nome', ''), nullif(j ->> 'autor', ''), 'Alguém');
  r record; pid uuid; pubid uuid;
begin
  if position('@' in txt) = 0 then return new; end if;
  if tg_table_name = 'posts' and coalesce((j ->> 'aprovado')::boolean, true) = false then return new; end if;
  if public.esta_banido(autor) then return new; end if;
  if tg_table_name = 'posts' then pid := (j ->> 'id')::uuid;
  elsif tg_table_name = 'post_comentarios' then pid := (j ->> 'post_id')::uuid;
  elsif tg_table_name = 'pub_comentarios' then pubid := (j ->> 'pub_id')::uuid; end if;
  for r in
    select p.user_id from public.perfis p
    where p.user_id <> autor and btrim(coalesce(p.apelido, p.nome, '')) <> ''
      and lower(txt) ~ ('@' || regexp_replace(lower(btrim(coalesce(p.apelido, p.nome))), '([][\\.()*+?^${}|])', '\\\1', 'g') || '($|[^[:alnum:]_])')
    limit 10
  loop
    insert into public.notificacoes (user_id, tipo, de_nome, post_id, pub_id, resumo)
    values (r.user_id, 'mencao', de, pid, pubid, left(txt, 120));
  end loop;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['posts', 'post_comentarios', 'pub_comentarios'] loop
    execute format('drop trigger if exists notif_mencao_t on public.%I', t);
    execute format('create trigger notif_mencao_t after insert on public.%I for each row execute function public.notif_mencao()', t);
  end loop;
end $$;
