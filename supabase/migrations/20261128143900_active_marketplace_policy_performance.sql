-- ACTIVE marketplace policy and index hardening
drop policy if exists "Developers read own profile" on public.active_developer_profiles;
create policy "Developers read own profile"
  on public.active_developer_profiles for select
  to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Developers create own profile" on public.active_developer_profiles;
create policy "Developers create own profile"
  on public.active_developer_profiles for insert
  to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Developers update own profile" on public.active_developer_profiles;
create policy "Developers update own profile"
  on public.active_developer_profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Developers create own submissions" on public.active_app_submissions;
create policy "Developers create own submissions"
  on public.active_app_submissions for insert
  to authenticated with check ((select auth.uid()) = developer_id);

drop policy if exists "Developers read own submissions" on public.active_app_submissions;
create policy "Developers read own submissions"
  on public.active_app_submissions for select
  to authenticated using ((select auth.uid()) = developer_id);

create index if not exists active_apps_developer_id_idx
  on public.active_apps (developer_id);
