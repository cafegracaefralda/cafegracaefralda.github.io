-- Café, Graça & Fralda · banco v17: editar o que você publicou, até 5 minutos depois (posts, comentários, publicações e mensagens).
-- Como usar: Supabase > SQL Editor > cole tudo > Run. Pode rodar mais de uma vez. Não apaga dados.
-- Regras: só a própria pessoa edita; só o texto muda; passou de 5 minutos, o banco recusa. Texto editado passa de novo pelo filtro de linguagem.

alter table public.posts add column if not exists editado_em timestamptz;
alter table public.post_comentarios add column if not exists editado_em timestamptz;
alter table public.pubs add column if not exists editado_em timestamptz;
alter table public.pub_comentarios add column if not exists editado_em timestamptz;
alter table public.dm_mensagens add column if not exists editado_em timestamptz;

drop policy if exists "posts: editar o proprio" on public.posts;
create policy "posts: editar o proprio" on public.posts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "post_comentarios: editar o proprio" on public.post_comentarios;
create policy "post_comentarios: editar o proprio" on public.post_comentarios for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "pubs: editar o proprio" on public.pubs;
create policy "pubs: editar o proprio" on public.pubs for update to authenticated using (user_id = auth.uid() and not oficial) with check (user_id = auth.uid() and not oficial);
drop policy if exists "pub_comentarios: editar o proprio" on public.pub_comentarios;
create policy "pub_comentarios: editar o proprio" on public.pub_comentarios for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "dm: editar o proprio" on public.dm_mensagens;
create policy "dm: editar o proprio" on public.dm_mensagens for update to authenticated using (de = auth.uid()) with check (de = auth.uid());

grant update (texto) on public.posts to authenticated;
grant update (texto) on public.post_comentarios to authenticated;
grant update (titulo, texto) on public.pubs to authenticated;
grant update (texto) on public.pub_comentarios to authenticated;
grant update (texto) on public.dm_mensagens to authenticated;

-- Gatilho: 5 minutos, só o texto, marca "editado". Administração não fica presa ao prazo.
create or replace function public.editar_conteudo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.eh_admin() then return new; end if;
  if public.esta_banido(auth.uid()) then raise exception 'conta_suspensa'; end if;
  if new.texto is distinct from old.texto or (to_jsonb(new) ->> 'titulo') is distinct from (to_jsonb(old) ->> 'titulo') then
    if now() - old.criado_em > interval '5 minutes' then raise exception 'tempo_esgotado'; end if;
    new.editado_em := now();
  end if;
  if tg_table_name = 'posts' then new.aprovado := old.aprovado; new.tipo := old.tipo; new.foto := old.foto; new.user_id := old.user_id; new.nome := old.nome;
  elsif tg_table_name = 'pubs' then new.aprovado := old.aprovado; new.fixado := old.fixado; new.oficial := old.oficial; new.user_id := old.user_id; new.tipo := old.tipo; new.arquivo := old.arquivo; new.link := old.link; new.youtube := old.youtube;
  elsif tg_table_name in ('post_comentarios', 'pub_comentarios') then new.user_id := old.user_id; new.nome := old.nome;
  elsif tg_table_name = 'dm_mensagens' then new.de := old.de; new.conversa_id := old.conversa_id; new.lida := old.lida; new.arquivo := old.arquivo; new.arquivo_nome := old.arquivo_nome; new.arquivo_tipo := old.arquivo_tipo; end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['posts', 'post_comentarios', 'pubs', 'pub_comentarios', 'dm_mensagens'] loop
    execute format('drop trigger if exists aa_editar_t on public.%I', t);
    execute format('create trigger aa_editar_t before update on public.%I for each row execute function public.editar_conteudo()', t);
  end loop;
  -- texto editado passa de novo pelo filtro de linguagem (alerta, esconde ou mascara)
  foreach t in array array['posts', 'post_comentarios', 'pub_comentarios'] loop
    execute format('drop trigger if exists zz_moderar_edit_t on public.%I', t);
    execute format('create trigger zz_moderar_edit_t before update of texto on public.%I for each row when (new.texto is distinct from old.texto) execute function public.moderar_conteudo()', t);
  end loop;
  execute 'drop trigger if exists zz_moderar_edit_t on public.pubs';
  execute 'create trigger zz_moderar_edit_t before update of titulo, texto on public.pubs for each row when (new.texto is distinct from old.texto or new.titulo is distinct from old.titulo) execute function public.moderar_conteudo()';
end $$;
