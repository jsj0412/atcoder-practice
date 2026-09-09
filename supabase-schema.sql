-- Supabase Dashboard의 SQL Editor에서 한 번 실행하세요.
-- 연습 링크를 아는 사람은 해당 연습을 읽고, 누구나 새 연습을 만들 수 있는 MVP 정책입니다.

create table if not exists public.practices (
  id uuid primary key,
  title text not null check (char_length(title) between 1 and 60),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  participants jsonb not null,
  min_difficulty integer not null,
  max_difficulty integer not null check (max_difficulty >= min_difficulty),
  ordering text not null check (ordering in ('random', 'difficulty')),
  problems jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.practices enable row level security;

grant select, insert on table public.practices to anon;

create policy "Anyone can read shared practices"
on public.practices for select to anon using (true);

create policy "Anyone can create a practice"
on public.practices for insert to anon with check (true);
