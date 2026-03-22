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
