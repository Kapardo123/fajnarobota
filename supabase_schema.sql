-- Tabela profili użytkowników (wspólna dla obu ról)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  role text check (role in ('candidate', 'employer')) not null,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela kandydatów (szczegóły)
create table public.candidates (
  id uuid references public.profiles(id) on delete cascade not null primary key,
  age integer,
  salary_expectation text,
  skills text[],
  superpower text,
  experience text check (experience in ('Junior', 'Mid', 'Senior')),
  blind_hiring boolean default false,
  avatar_traits jsonb
);

-- Tabela pracodawców (szczegóły firmy)
create table public.employers (
  id uuid references public.profiles(id) on delete cascade not null primary key,
  company_name text,
  company_description text,
  industry text
);

-- Tabela ofert pracy
create table public.jobs (
  id uuid default gen_random_uuid() primary key,
  employer_id uuid references public.employers(id) on delete cascade not null,
  title text not null,
  salary_range text,
  location text,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Włącz RLS (Row Level Security)
alter table public.profiles enable row level security;
alter table public.candidates enable row level security;
alter table public.employers enable row level security;
alter table public.jobs enable row level security;

-- Polityki bezpieczeństwa (uproszczone na start)
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

create policy "Candidates are viewable by everyone." on public.candidates for select using (true);
create policy "Candidates can update own data." on public.candidates for update using (auth.uid() = id);

create policy "Employers are viewable by everyone." on public.employers for select using (true);
create policy "Employers can update own data." on public.employers for update using (auth.uid() = id);

create policy "Jobs are viewable by everyone." on public.jobs for select using (true);
create policy "Employers can manage own jobs." on public.jobs for all using (auth.uid() = employer_id);

-- Tabela swipe'ów (kto na kogo)
create table public.swipes (
  id uuid default gen_random_uuid() primary key,
  swiper_id uuid references public.profiles(id) on delete cascade not null,
  target_id uuid not null, -- Może być ID kandydata (profile.id) lub ID pracy (job.id)
  direction text check (direction in ('left', 'right')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela dopasowań (Matches)
create table public.matches (
  id uuid default gen_random_uuid() primary key,
  candidate_id uuid references public.profiles(id) on delete cascade not null,
  employer_id uuid references public.profiles(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(candidate_id, job_id) -- Jeden kandydat może pasować do danej pracy tylko raz
);

-- Włącz RLS dla nowych tabel
alter table public.swipes enable row level security;
alter table public.matches enable row level security;

-- Polityki dla swipes
create policy "Users can view own swipes." on public.swipes for select using (auth.uid() = swiper_id);
create policy "Users can insert own swipes." on public.swipes for insert with check (auth.uid() = swiper_id);

-- Polityki dla matches
create policy "Users can view own matches." on public.matches for select using (auth.uid() = candidate_id or auth.uid() = employer_id);

-- Tabela wiadomości (Chat)
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Włącz RLS dla messages
alter table public.messages enable row level security;

-- Polityki dla messages
create policy "Users can view messages from own matches." on public.messages for select 
  using (exists (select 1 from public.matches where id = match_id and (candidate_id = auth.uid() or employer_id = auth.uid())));

create policy "Users can send messages to own matches." on public.messages for insert 
  with check (auth.uid() = sender_id and exists (select 1 from public.matches where id = match_id and (candidate_id = auth.uid() or employer_id = auth.uid())));
