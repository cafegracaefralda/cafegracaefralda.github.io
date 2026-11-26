-- Café, Graça & Fralda · banco v22: postagem da Casa (A Casa) com fotos, vídeos, PDFs, link e YouTube JUNTOS na mesma publicação.
-- Como usar: Supabase > SQL Editor > cole tudo > Run (depois do v21). Pode rodar mais de uma vez. Não apaga dados.
-- Só a administração usa os anexos extras. Os arquivos ficam no bucket público "prateleira" (foto JPEG, PDF, MP4/WebM até 30 MB).

alter table public.pubs add column if not exists fotos text[];
alter table public.pubs add column if not exists videos text[];
alter table public.pubs add column if not exists docs text[];
alter table public.pubs add column if not exists docs_nomes text[];
alter table public.pubs drop constraint if exists pubs_extras_ok;
alter table public.pubs add constraint pubs_extras_ok check (
  (fotos is null or cardinality(fotos) between 1 and 6)
  and (videos is null or cardinality(videos) between 1 and 2)
  and (docs is null or cardinality(docs) between 1 and 3)
  and (docs_nomes is null or cardinality(docs_nomes) = coalesce(cardinality(docs), 0)));

create or replace function public.pub_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare f text;
begin
  if auth.uid() is null then raise exception 'login_necessario'; end if;
  new.user_id := auth.uid();
  new.autor := public.primeiro_nome(auth.uid());
  new.aprovado := true;
  if not public.eh_admin() then
    new.oficial := false; new.fixado := false;
    if new.fotos is not null or new.videos is not null or new.docs is not null or new.docs_nomes is not null then raise exception 'dados_invalidos'; end if;
    if new.tipo not in ('texto', 'foto', 'audio', 'pdf', 'youtube', 'link') then raise exception 'dados_invalidos'; end if;
    if new.arquivo ~* '\.(mp4|webm|mov)$' and new.tipo <> 'audio' then raise exception 'dados_invalidos'; end if;
    if (select count(*) from public.pubs where user_id = new.user_id and criado_em > now() - interval '1 hour') >= 10 then raise exception 'muito_rapido'; end if;
  end if;
  if new.arquivo is not null and split_part(new.arquivo, '/', 1) <> auth.uid()::text then raise exception 'dados_invalidos'; end if;
  if new.fotos is not null then foreach f in array new.fotos loop
    if f !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' or split_part(f, '/', 1) <> auth.uid()::text then raise exception 'dados_invalidos'; end if; end loop; end if;
  if new.videos is not null then foreach f in array new.videos loop
    if f !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|webm)$' or split_part(f, '/', 1) <> auth.uid()::text then raise exception 'dados_invalidos'; end if; end loop; end if;
  if new.docs is not null then foreach f in array new.docs loop
    if f !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' or split_part(f, '/', 1) <> auth.uid()::text then raise exception 'dados_invalidos'; end if; end loop; end if;
  return new;
end $$;
drop trigger if exists pub_antes_t on public.pubs;
create trigger pub_antes_t before insert on public.pubs for each row execute function public.pub_antes();

grant insert (tipo, titulo, texto, arquivo, arquivo_nome, youtube, link, link_texto, oficial, fixado, fotos, videos, docs, docs_nomes) on public.pubs to authenticated;
grant select (id, autor, oficial, tipo, titulo, texto, arquivo, arquivo_nome, youtube, link, link_texto, fixado, aprovado, criado_em, fotos, videos, docs, docs_nomes) on public.pubs to anon;
