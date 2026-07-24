-- Public card projection. It deliberately returns no internal identifiers or contact data.

create or replace function app.get_public_web_card(target_card_token text)
returns table (
  tenant_name text,
  branding_mode public.branding_mode,
  logo_url text,
  primary_color text,
  secondary_color text,
  customer_name text
)
language sql
security definer
set search_path = public, app, auth
as $$
  select t.name, t.branding_mode, t.logo_url, t.primary_color, t.secondary_color,
         c.full_name
  from public.customer_cards cc
  join public.customers c on c.id = cc.customer_id
  join public.tenants t on t.id = cc.tenant_id
  where cc.public_token = target_card_token
    and cc.status = 'ACTIVE'
    and t.status = 'ACTIVE';
$$;

revoke all on function app.get_public_web_card(text) from public, authenticated;
grant execute on function app.get_public_web_card(text) to anon;
grant usage on schema app to anon;
