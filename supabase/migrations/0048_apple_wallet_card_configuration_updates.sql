-- Queue installed Apple passes when their card-owned design or branch scope
-- changes. The original Wallet triggers predate loyalty_cards and therefore
-- only observe the legacy tenant-wide design table.

create function app.queue_apple_wallet_card_updates(target_loyalty_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  changed_pass record;
begin
  if target_loyalty_card_id is null then
    return;
  end if;

  for changed_pass in
    update public.wallet_passes wallet_pass
       set update_tag = nextval('public.apple_wallet_update_tag_seq'),
           status = 'UPDATE_PENDING',
           update_pending_at = now(),
           last_error = null
     where wallet_pass.provider = 'APPLE'
       and wallet_pass.status in ('ACTIVE', 'UPDATE_PENDING', 'FAILED')
       and exists (
         select 1
         from public.customer_cards issued
         where issued.id = wallet_pass.customer_card_id
           and issued.loyalty_card_id = target_loyalty_card_id
       )
       and exists (
         select 1
         from public.apple_wallet_registrations registration
         where registration.wallet_pass_id = wallet_pass.id
       )
    returning wallet_pass.id, wallet_pass.update_tag
  loop
    insert into public.apple_wallet_update_outbox (
      wallet_pass_id,
      update_tag
    )
    values (
      changed_pass.id,
      changed_pass.update_tag
    )
    on conflict (wallet_pass_id) do update
      set update_tag = excluded.update_tag,
          attempt_count = 0,
          next_attempt_at = now(),
          last_attempt_at = null,
          last_error = null,
          claim_token = null,
          locked_until = null,
          updated_at = now();
  end loop;
end;
$$;

create function app.queue_apple_wallet_card_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  perform app.queue_apple_wallet_card_updates(new.id);
  return new;
end;
$$;

create function app.queue_apple_wallet_card_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  if tg_op = 'DELETE' then
    perform app.queue_apple_wallet_card_updates(old.loyalty_card_id);
    return old;
  elsif tg_op = 'INSERT' then
    perform app.queue_apple_wallet_card_updates(new.loyalty_card_id);
    return new;
  end if;

  perform app.queue_apple_wallet_card_updates(old.loyalty_card_id);
  if new.loyalty_card_id is distinct from old.loyalty_card_id then
    perform app.queue_apple_wallet_card_updates(new.loyalty_card_id);
  end if;
  return new;
end;
$$;

create trigger apple_wallet_loyalty_card_changed
  after update of
    status,
    wallet_enabled,
    logo_text,
    description,
    background_color,
    foreground_color,
    label_color,
    logo_image_url,
    strip_image_url
  on public.loyalty_cards
  for each row execute function app.queue_apple_wallet_card_row_change();

create trigger apple_wallet_loyalty_card_branch_changed
  after insert or update or delete on public.loyalty_card_branches
  for each row execute function app.queue_apple_wallet_card_assignment_change();

revoke all on function app.queue_apple_wallet_card_updates(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.queue_apple_wallet_card_row_change()
  from public, anon, authenticated, service_role;
revoke all on function app.queue_apple_wallet_card_assignment_change()
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
