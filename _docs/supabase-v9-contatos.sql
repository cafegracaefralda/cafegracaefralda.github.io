-- Café, Graça & Fralda · banco de dados v9: WhatsApp de quem entra no site (contato da comunidade).
--
-- Como usar: Supabase > SQL Editor > cole este arquivo inteiro > Run (depois do supabase-v2.sql).
-- Pode rodar mais de uma vez sem problema. Não apaga nada.
--
-- Privacidade (LGPD): o WhatsApp é pedido no primeiro login, com aceite claro. NÃO aparece para outros membros:
-- cada pessoa vê só o próprio número; só a administração vê a lista (nome, e-mail, WhatsApp) pelo Painel.

create table if not exists public.contatos (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  consentimento boolean not null default true,
  atualizado_em timestamptz not null default now()
);

alter table public.contatos enable row level security;
drop policy if exists "contatos: ler o proprio" on public.contatos;
drop policy if exists "contatos: criar o proprio" on public.contatos;
drop policy if exists "contatos: editar o proprio" on public.contatos;
create policy "contatos: ler o proprio" on public.contatos for select to authenticated using (user_id = auth.uid() or public.eh_admin());
create policy "contatos: criar o proprio" on public.contatos for insert to authenticated with check (user_id = auth.uid());
create policy "contatos: editar o proprio" on public.contatos for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.contatos_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.whatsapp := regexp_replace(new.whatsapp, '[^0-9]', '', 'g');
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists contatos_antes_t on public.contatos;
create trigger contatos_antes_t before insert or update on public.contatos for each row execute function public.contatos_antes();

revoke all on public.contatos from anon, authenticated;
grant select on public.contatos to authenticated;
grant insert (whatsapp, consentimento) on public.contatos to authenticated;
grant update (whatsapp, consentimento) on public.contatos to authenticated;

-- Lista para a administração: nome, e-mail e WhatsApp de quem entrou
create or replace function public.membros_contatos()
returns table (nome text, email text, whatsapp text, desde timestamptz)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  return query
    select coalesce(nullif(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), ''), '(sem nome)')::text,
           u.email::text, c.whatsapp, u.created_at
    from auth.users u left join public.contatos c on c.user_id = u.id
    order by u.created_at desc;
end $$;
revoke all on function public.membros_contatos() from public, anon;
grant execute on function public.membros_contatos() to authenticated;
