-- Café, Graça & Fralda · banco de dados v7: postagens oficiais ("Da Casa").
--
-- Como usar: Supabase > SQL Editor > cole este arquivo inteiro > Run (depois do supabase-v2.sql).
-- Pode rodar mais de uma vez sem problema. Não apaga nada.
--
-- Só o Denny (administrador) publica, edita e apaga. Qualquer pessoa lê (são avisos, devocionais extras,
-- convites e indicações de parceiros). As imagens ficam num bucket público só para estas postagens.

create table if not exists public.oficiais (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'aviso' check (tipo in ('aviso', 'devocional', 'evento', 'parceiro')),
  titulo text not null check (char_length(titulo) between 2 and 120),
  texto text not null check (char_length(texto) between 2 and 2000),
  imagem text check (imagem is null or imagem ~ '^[0-9a-f-]{36}\.jpg$'),
  link text check (link is null or link ~ '^https?://'),
  link_texto text check (link_texto is null or char_length(link_texto) <= 40),
  fixado boolean not null default false,
  publicado boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists oficiais_idx on public.oficiais (publicado, fixado desc, criado_em desc);

alter table public.oficiais enable row level security;
drop policy if exists "oficiais: ler" on public.oficiais;
drop policy if exists "oficiais: admin escreve" on public.oficiais;
create policy "oficiais: ler" on public.oficiais for select to anon, authenticated using (publicado or public.eh_admin());
create policy "oficiais: admin escreve" on public.oficiais for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

revoke all on public.oficiais from anon, authenticated;
grant select on public.oficiais to anon, authenticated;
grant insert, update, delete on public.oficiais to authenticated;

-- Imagens das postagens oficiais: leitura pública, envio e exclusão só do administrador (JPEG até 3 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('oficial', 'oficial', true, 3145728, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg'];

drop policy if exists "oficial imagens: ver" on storage.objects;
drop policy if exists "oficial imagens: admin envia" on storage.objects;
drop policy if exists "oficial imagens: admin apaga" on storage.objects;
create policy "oficial imagens: ver" on storage.objects for select to anon, authenticated using (bucket_id = 'oficial');
create policy "oficial imagens: admin envia" on storage.objects for insert to authenticated with check (bucket_id = 'oficial' and public.eh_admin());
create policy "oficial imagens: admin apaga" on storage.objects for delete to authenticated using (bucket_id = 'oficial' and public.eh_admin());
