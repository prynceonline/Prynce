-- ACTIVE marketplace foundation
-- Apply with Supabase CLI: supabase db push
-- Public users can read approved catalogue metadata only.
-- APK binaries are hosted as GitHub Release assets; never store binaries in Postgres.

create extension if not exists pgcrypto;

create table if not exists public.active_developer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.active_apps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 100),
  summary text not null check (char_length(summary) between 10 and 280),
  description text not null default '',
  category text not null,
  icon_url text,
  website_url text,
  developer_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('draft','pending','approved','rejected','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.active_app_releases (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.active_apps(id) on delete cascade,
  version text not null check (char_length(version) between 1 and 40),
  platform text not null check (platform in ('android','web')),
  architecture text,
  min_os_version text,
  asset_url text not null check (asset_url ~ '^https://'),
  asset_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[a-fA-F0-9]{64}$'),
  release_notes text not null default '',
  status text not null default 'pending'
    check (status in ('pending','published','rejected','withdrawn')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (app_id, version, platform, coalesce(architecture, ''))
);

create table if not exists public.active_app_submissions (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references auth.users(id) on delete cascade,
  app_name text not null check (char_length(app_name) between 2 and 100),
  package_id text,
  category text not null,
  website_url text,
  source_repository text,
  notes text not null default '',
  status text not null default 'submitted'
    check (status in ('submitted','under_review','approved','rejected')),
  reviewer_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists active_apps_public_catalogue_idx
  on public.active_apps (category, name) where status = 'approved';
create index if not exists active_releases_published_idx
  on public.active_app_releases (app_id, platform, published_at desc)
  where status = 'published';
create index if not exists active_submissions_owner_idx
  on public.active_app_submissions (developer_id, created_at desc);

alter table public.active_developer_profiles enable row level security;
alter table public.active_apps enable row level security;
alter table public.active_app_releases enable row level security;
alter table public.active_app_submissions enable row level security;

-- Public catalogue visibility is limited to approved apps and published releases.
drop policy if exists "Public can read approved ACTIVE apps" on public.active_apps;
create policy "Public can read approved ACTIVE apps"
  on public.active_apps for select
  using (status = 'approved');

drop policy if exists "Public can read published ACTIVE releases" on public.active_app_releases;
create policy "Public can read published ACTIVE releases"
  on public.active_app_releases for select
  using (
    status = 'published'
    and exists (
      select 1 from public.active_apps a
      where a.id = app_id and a.status = 'approved'
    )
  );

-- Signed-in developers can manage only their own profile and create submissions.
drop policy if exists "Developers read own profile" on public.active_developer_profiles;
create policy "Developers read own profile"
  on public.active_developer_profiles for select
  to authenticated using (user_id = auth.uid());

drop policy if exists "Developers create own profile" on public.active_developer_profiles;
create policy "Developers create own profile"
  on public.active_developer_profiles for insert
  to authenticated with check (user_id = auth.uid());

drop policy if exists "Developers update own profile" on public.active_developer_profiles;
create policy "Developers update own profile"
  on public.active_developer_profiles for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Developers create own submissions" on public.active_app_submissions;
create policy "Developers create own submissions"
  on public.active_app_submissions for insert
  to authenticated with check (developer_id = auth.uid());

drop policy if exists "Developers read own submissions" on public.active_app_submissions;
create policy "Developers read own submissions"
  on public.active_app_submissions for select
  to authenticated using (developer_id = auth.uid());

-- No client-side insert/update policy exists for apps or releases.
-- Publication and release approval must be performed by a trusted server/admin workflow.
-- Never expose the Supabase service-role key in browser code.
