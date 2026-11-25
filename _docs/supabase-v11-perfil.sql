-- Café, Graça & Fralda · banco v11: perfil pessoal (nome escolhido, bio, cidade e foto).
-- Como usar: Supabase > SQL Editor > cole tudo > Run (depois do v3 e v4). Pode rodar mais de uma vez.
-- O nome que a pessoa escolhe passa a valer em tudo que ela publicar daqui para frente (posts, comentários, Prateleira, Quintal, mensagens).
-- Privacidade: só o apelido, a cidade, a bio e a foto aparecem para os outros membros (e-mail e WhatsApp continuam privados).

alter table public.perfis add column if not exists apelido text;
alter table public.perfis add column if not exists bio text;
alter table public.perfis add column if not exists cidade text;
alter table public.perfis add column if not exists avatar text;
alter table public.perfis drop constraint if exists perfis_apelido_check;
alter table public.perfis add constraint perfis_apelido_check check (apelido is null or char_length(btrim(apelido)) between 2 and 30);
alter table public.perfis drop constraint if exists perfis_bio_check;
alter table public.perfis add constraint perfis_bio_check check (bio is null or char_length(bio) <= 160);
alter table public.perfis drop constraint if exists perfis_cidade_check;
alter table public.perfis add constraint perfis_cidade_check check (cidade is null or char_length(cidade) <= 60);

-- Todos os gatilhos que gravam "autor"/"nome" usam esta função: agora ela prefere o apelido escolhido.
create or replace function public.primeiro_nome(uid uuid)
returns text language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select nullif(btrim(p.apelido), '') from public.perfis p where p.user_id = uid),
    nullif(split_part(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), ' ', 1), ''),
    'Visitante')
  from auth.users u where u.id = uid;
$$;
revoke all on function public.primeiro_nome(uuid) from public, anon, authenticated;

-- Mantém "nome" (usado na lista de conversas) igual ao apelido; avatar só dentro da pasta da própria pessoa.
create or replace function public.perfis_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.apelido is not null then new.apelido := btrim(new.apelido); new.nome := new.apelido; end if;
  if new.avatar is not null and split_part(new.avatar, '/', 1) <> new.user_id::text then raise exception 'dados_invalidos'; end if;
  return new;
end $$;
drop trigger if exists perfis_antes_t on public.perfis;
create trigger perfis_antes_t before insert or update on public.perfis for each row execute function public.perfis_antes();

grant select on public.perfis to authenticated;
grant update (aceita_dm, apelido, bio, cidade, avatar) on public.perfis to authenticated;
