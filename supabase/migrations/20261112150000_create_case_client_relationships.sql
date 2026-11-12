-- Case-to-client relationships, preserving multiple clients and review status per case.
create table if not exists public.case_clients (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  role_in_case text not null default 'موکل',
  representation_status text not null default 'needs_review'
    check (representation_status in ('represented','needs_review','not_represented')),
  source_note text,
  created_at timestamptz not null default now(),
  unique (case_id, client_id, role_in_case)
);

create index if not exists case_clients_office_case_idx
  on public.case_clients (office_id, case_id);
create index if not exists case_clients_office_client_idx
  on public.case_clients (office_id, client_id);

alter table public.case_clients enable row level security;

drop policy if exists office_members_can_read_case_clients on public.case_clients;
create policy office_members_can_read_case_clients
on public.case_clients for select to authenticated
using ((select private.is_office_member(office_id)));

drop policy if exists office_staff_can_insert_case_clients on public.case_clients;
create policy office_staff_can_insert_case_clients
on public.case_clients for insert to authenticated
with check ((select private.has_office_role(office_id, array['owner','admin','lawyer','staff']::text[])));

drop policy if exists office_staff_can_update_case_clients on public.case_clients;
create policy office_staff_can_update_case_clients
on public.case_clients for update to authenticated
using ((select private.has_office_role(office_id, array['owner','admin','lawyer','staff']::text[])))
with check ((select private.has_office_role(office_id, array['owner','admin','lawyer','staff']::text[])));

drop policy if exists office_admins_can_delete_case_clients on public.case_clients;
create policy office_admins_can_delete_case_clients
on public.case_clients for delete to authenticated
using ((select private.has_office_role(office_id, array['owner','admin']::text[])));
