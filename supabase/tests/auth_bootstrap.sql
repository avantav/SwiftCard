-- Minimal local substitute for the Supabase-managed auth objects used by migrations.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;

-- Minimal local substitute for Supabase Storage objects used by migrations.
create schema storage;

create table storage.buckets (
  id text primary key,
  name text not null unique,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  bucket_id text not null references storage.buckets(id),
  name text not null,
  primary key (bucket_id, name)
);

alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;

create function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select case
    when array_length(string_to_array(name, '/'), 1) > 1
      then (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
    else array[]::text[]
  end;
$$;

create function storage.filename(name text)
returns text
language sql
immutable
as $$
  select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)];
$$;

create table auth.users (
  id uuid primary key,
  email text not null unique
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
