\set ON_ERROR_STOP on

begin;

do $$
declare
  configured_bucket record;
begin
  select * into configured_bucket
  from storage.buckets
  where id = 'wallet-assets';

  if configured_bucket.id is null
    or not configured_bucket.public
    or configured_bucket.file_size_limit <> 5242880
    or configured_bucket.allowed_mime_types <> array['image/png', 'image/jpeg', 'image/webp'] then
    raise exception 'Wallet asset bucket configuration is invalid';
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

insert into storage.objects (bucket_id, name)
values (
  'wallet-assets',
  '10000000-0000-0000-0000-000000000001/apple/logo-11111111-1111-4111-8111-111111111111.png'
);

do $$
begin
  begin
    insert into storage.objects (bucket_id, name)
    values (
      'wallet-assets',
      '10000000-0000-0000-0000-000000000001/apple/other-file.png'
    );
    raise exception 'Admin uploaded a non-Wallet object name';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects (bucket_id, name)
    values (
      'wallet-assets',
      '20000000-0000-0000-0000-000000000001/apple/logo-22222222-2222-4222-8222-222222222222.png'
    );
    raise exception 'Admin uploaded a Wallet asset into another tenant path';
  exception when insufficient_privilege then null;
  end;
end;
$$;

delete from storage.objects
where bucket_id = 'wallet-assets'
  and name = '10000000-0000-0000-0000-000000000001/apple/logo-11111111-1111-4111-8111-111111111111.png';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);

do $$
begin
  begin
    insert into storage.objects (bucket_id, name)
    values (
      'wallet-assets',
      '10000000-0000-0000-0000-000000000001/apple/strip-33333333-3333-4333-8333-333333333333.jpg'
    );
    raise exception 'Branch Administrator uploaded a tenant Wallet asset';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;

select 'Apple Wallet Storage assertions passed' as result;
