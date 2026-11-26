-- Café, Graça & Fralda · banco v14: stories somem em 48 horas (antes eram 24).
-- Como usar: Supabase > SQL Editor > cole tudo > Run. Pode rodar mais de uma vez. Não apaga dados.
drop policy if exists "stories: ler" on public.stories;
create policy "stories: ler" on public.stories for select to authenticated using (criado_em > now() - interval '48 hours');

-- Avisa a administração (sininho) quando alguém pede para anunciar ou envia uma oferta para revisão.
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo in ('comentario', 'curtida', 'dm', 'pub_comentario', 'pub_curtida', 'alerta', 'aviso', 'mencao', 'pedido', 'casa', 'seguir', 'story_curtida'));

create or replace function public.notif_pedido_anuncio()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare adm record; txt text;
begin
  if tg_table_name = 'anunciantes' then txt := 'Pedido para anunciar: ' || new.marca;
  elsif new.status = 'pendente' then txt := 'Oferta para revisar: ' || new.titulo;
  else return new; end if;
  for adm in select u.id from auth.users u join public.admins a on lower(a.email) = lower(u.email) loop
    insert into public.notificacoes (user_id, tipo, de_nome, resumo) values (adm.id, 'pedido', coalesce(nullif(new.marca, ''), 'Parceiro'), left(txt, 120));
  end loop;
  return new;
end $$;
drop trigger if exists notif_pedido_anunciantes_t on public.anunciantes;
create trigger notif_pedido_anunciantes_t after insert on public.anunciantes for each row execute function public.notif_pedido_anuncio();
drop trigger if exists notif_pedido_ofertas_t on public.ofertas;
create trigger notif_pedido_ofertas_t after insert on public.ofertas for each row execute function public.notif_pedido_anuncio();
