-- Café, Graça & Fralda · banco v20: posts da Mesa com até 3 fotos e anexo em PDF (o PDF é só da administração).
-- Como usar: Supabase > SQL Editor > cole tudo > Run (depois do v19). Pode rodar mais de uma vez. Não apaga dados.

alter table public.posts add column if not exists fotos text[];
alter table public.posts add column if not exists anexo text;
alter table public.posts add column if not exists anexo_nome text;
alter table public.posts drop constraint if exists posts_anexo_nome_ok;
alter table public.posts add constraint posts_anexo_nome_ok check (anexo_nome is null or char_length(anexo_nome) between 1 and 120);
alter table public.posts drop constraint if exists posts_fotos_max3;
alter table public.posts add constraint posts_fotos_max3 check (fotos is null or cardinality(fotos) between 1 and 3);
alter table public.posts drop constraint if exists posts_anexo_ok;
alter table public.posts add constraint posts_anexo_ok check (anexo is null or anexo ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$');

-- O bucket das fotos aceita também PDF (até 5 MB). Quem anexa PDF a um post é só a administração.
update storage.buckets set allowed_mime_types = array['image/jpeg', 'application/pdf'], file_size_limit = 5242880 where id = 'mural';

create or replace function public.post_antes_de_inserir()
returns trigger language plpgsql security definer set search_path = public as $$
declare f text;
begin
  if auth.uid() is null then raise exception 'login_necessario'; end if;
  new.user_id := auth.uid();
  new.nome := public.primeiro_nome(auth.uid());
  new.aprovado := true;
  if new.foto is not null and split_part(new.foto, '/', 1) <> auth.uid()::text then raise exception 'dados_invalidos'; end if;
  if new.fotos is not null then
    foreach f in array new.fotos loop
      if f !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' or split_part(f, '/', 1) <> auth.uid()::text then raise exception 'dados_invalidos'; end if;
    end loop;
    new.foto := new.fotos[1];
  end if;
  if new.anexo is not null and (not public.eh_admin() or split_part(new.anexo, '/', 1) <> auth.uid()::text) then raise exception 'dados_invalidos'; end if;
  if not public.eh_admin() and (select count(*) from public.posts where user_id = new.user_id and criado_em > now() - interval '1 hour') >= 10 then
    raise exception 'muito_rapido';
  end if;
  return new;
end $$;
drop trigger if exists post_antes on public.posts;
create trigger post_antes before insert on public.posts for each row execute function public.post_antes_de_inserir();

grant insert (tipo, texto, foto, fotos, anexo, anexo_nome) on public.posts to authenticated;
