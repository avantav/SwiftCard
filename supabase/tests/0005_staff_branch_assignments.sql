\set ON_ERROR_STOP on

set role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000011',
  false
);

select app.set_staff_branch_assignment(
  '00000000-0000-0000-0000-000000000013',
  '20000000-0000-0000-0000-000000000001',
  true,
  true
);

do $$
declare
  primary_branch uuid;
  assignment_count integer;
begin
  select count(*)
    into assignment_count
  from public.staff_branch_assignments
  where staff_profile_id = '00000000-0000-0000-0000-000000000013';

  select branch_id
    into primary_branch
  from public.staff_branch_assignments
  where staff_profile_id = '00000000-0000-0000-0000-000000000013'
    and is_primary;

  if assignment_count <> 2 or primary_branch <> '20000000-0000-0000-0000-000000000001' then
    raise exception 'Employee A primary assignment was not switched atomically';
  end if;
end;
$$;

do $$
begin
  begin
    perform app.set_staff_branch_assignment(
      '00000000-0000-0000-0000-000000000021',
      '20000000-0000-0000-0000-000000000001',
      true,
      true
    );
    raise exception 'Cross-tenant staff assignment was accepted';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

update public.branches
set status = 'INACTIVE'
where id = '20000000-0000-0000-0000-000000000002';

do $$
begin
  begin
    perform app.set_staff_branch_assignment(
      '00000000-0000-0000-0000-000000000012',
      '20000000-0000-0000-0000-000000000002',
      true,
      false
    );
    raise exception 'Assignment to inactive branch was accepted';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000013',
  false
);

set role authenticated;

do $$
begin
  begin
    perform app.set_staff_branch_assignment(
      '00000000-0000-0000-0000-000000000013',
      '20000000-0000-0000-0000-000000000001',
      false,
      false
    );
    raise exception 'Employee assigned branches directly';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

select 'Staff branch assignment assertions passed' as result;
