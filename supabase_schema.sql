-- 파이오니아 멘토링팀 9기 분담표 · 수파베이스 스키마
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run

create table if not exists public.board_roles (
  key text primary key,          -- lead / m1 / m2 / m3
  name text not null default ''
);

create table if not exists public.board_tasks (
  id text primary key,           -- a01 … e05, 팀 추가 항목은 x… 
  area text not null default 'E',
  name text not null default '',
  when_ text not null default '',
  owner text not null default 'lead',
  support text[] not null default '{}',
  note text not null default '',
  custom boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.board_links (
  key text primary key,          -- sheet / drive
  url text not null default ''
);

-- 링크만 알면 누구나 읽고 쓸 수 있게 (팀 내부용 · 링크 비공개 유지)
alter table public.board_roles enable row level security;
alter table public.board_tasks enable row level security;
alter table public.board_links enable row level security;

drop policy if exists "anon all roles" on public.board_roles;
drop policy if exists "anon all tasks" on public.board_tasks;
drop policy if exists "anon all links" on public.board_links;
create policy "anon all roles" on public.board_roles for all to anon using (true) with check (true);
create policy "anon all tasks" on public.board_tasks for all to anon using (true) with check (true);
create policy "anon all links" on public.board_links for all to anon using (true) with check (true);

-- 실시간 반영
alter publication supabase_realtime add table public.board_roles;
alter publication supabase_realtime add table public.board_tasks;
alter publication supabase_realtime add table public.board_links;
