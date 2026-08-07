-- Atomically assigns or unassigns tenant staff branches and preserves primary state.

create or replace function app.set_staff_branch_assignment(
  target_staff_profile_id uuid,
  target_branch_id uuid,
  should_assign boolean,
  make_primary boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  current_tenant_id uuid;
  staff_role_value public.staff_role;
  assignment_id uuid;
  has_assignments boolean;
begin
  if not app.current_staff_is_active()
    or not app.current_tenant_is_active()
    or app.current_staff_role() <> 'ADMIN' then
    raise exception 'an active tenant Admin is required'
      using errcode = '42501';
  end if;

  current_tenant_id := app.current_staff_tenant_id();

  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:staff-branches:' || target_staff_profile_id::text, 0)
  );

  select sp.role
    into staff_role_value
  from public.staff_profiles sp
  where sp.id = target_staff_profile_id
    and sp.tenant_id = current_tenant_id
    and sp.role in ('MANAGER', 'EMPLOYEE');

  if not found then
    raise exception 'staff profile is not assignable in this tenant'
      using errcode = '42501';
  end if;

  if should_assign then
    if not exists (
      select 1
      from public.branches b
      where b.id = target_branch_id
        and b.tenant_id = current_tenant_id
        and b.status = 'ACTIVE'
    ) then
      raise exception 'branch is not active in this tenant'
        using errcode = '42501';
    end if;

    select exists (
      select 1
      from public.staff_branch_assignments sba
      where sba.staff_profile_id = target_staff_profile_id
    ) into has_assignments;

    if make_primary or not has_assignments then
      update public.staff_branch_assignments
      set is_primary = false
      where staff_profile_id = target_staff_profile_id;
    end if;

    insert into public.staff_branch_assignments (
      tenant_id,
      staff_profile_id,
      branch_id,
      is_primary
    ) values (
      current_tenant_id,
      target_staff_profile_id,
      target_branch_id,
      make_primary or not has_assignments
    )
    on conflict (staff_profile_id, branch_id)
    do update set is_primary = excluded.is_primary
    returning id into assignment_id;

    return assignment_id;
  end if;

  delete from public.staff_branch_assignments
  where staff_profile_id = target_staff_profile_id
    and branch_id = target_branch_id
  returning id into assignment_id;

  if assignment_id is not null then
    if not exists (
      select 1
      from public.staff_branch_assignments sba
      where sba.staff_profile_id = target_staff_profile_id
        and sba.is_primary
    ) then
      update public.staff_branch_assignments
      set is_primary = true
      where id = (
        select sba.id
        from public.staff_branch_assignments sba
        where sba.staff_profile_id = target_staff_profile_id
        order by sba.created_at, sba.id
        limit 1
      );
    end if;
  end if;

  return assignment_id;
end;
$$;

revoke all on function app.set_staff_branch_assignment(uuid, uuid, boolean, boolean)
from public, anon;

grant execute on function app.set_staff_branch_assignment(uuid, uuid, boolean, boolean)
to authenticated;
