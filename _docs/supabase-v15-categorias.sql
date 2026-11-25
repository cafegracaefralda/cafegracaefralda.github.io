-- Café, Graça & Fralda · banco v15: Vizinhança com categorias livres (saúde, fé, lazer, esporte, cultura, filmes e séries, comer, hospedagem...).
-- Como usar: Supabase > SQL Editor > cole tudo > Run. Pode rodar mais de uma vez. Não apaga dados.
-- Linhas antigas com categoria fora da lista viram "Outro" (evita erro ao criar a regra).
update public.indicacoes_membros set categoria = 'Outro' where categoria not in ('Saúde dos pequenos', 'Gestação e bebê', 'Mente e emoções', 'Desenvolvimento', 'Casamento', 'Hotéis e pousadas', 'Restaurantes e cafés', 'Praças e parques', 'Passeios e lazer', 'Serviços para a casa', 'Escolas e creches', 'Saúde', 'Fé e religião', 'Educação', 'Família', 'Casa', 'Outro');
alter table public.indicacoes_membros drop constraint if exists indicacoes_membros_categoria_check;
alter table public.indicacoes_membros add constraint indicacoes_membros_categoria_check check (categoria in (
  'Saúde dos pequenos', 'Gestação e bebê', 'Mente e emoções', 'Desenvolvimento', 'Casamento', 'Hotéis e pousadas', 'Restaurantes e cafés', 'Praças e parques',
  'Passeios e lazer', 'Serviços para a casa', 'Escolas e creches', 'Saúde', 'Fé e religião', 'Educação', 'Família', 'Casa', 'Outro'));
update public.lazer set categoria = 'Outro' where categoria not in ('Parque e natureza', 'Restaurante e café', 'Espaço kids', 'Passeio e cultura', 'Esporte', 'Evento', 'Lazer', 'Praças e parques', 'Cultura', 'Filmes e séries', 'Comer', 'Hospedagem', 'Outro');
alter table public.lazer drop constraint if exists lazer_categoria_check;
alter table public.lazer add constraint lazer_categoria_check check (categoria in (
  'Parque e natureza', 'Restaurante e café', 'Espaço kids', 'Passeio e cultura', 'Esporte', 'Evento',
  'Lazer', 'Praças e parques', 'Cultura', 'Filmes e séries', 'Comer', 'Hospedagem', 'Outro'));
