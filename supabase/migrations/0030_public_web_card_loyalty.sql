-- Phase 8 fallback: keep the public Web Card current with loyalty state.

drop function if exists app.get_public_web_card(text);

create function app.get_public_web_card(target_card_token text)
returns table (tenant_name text, branding_mode public.branding_mode, logo_url text, primary_color text, secondary_color text, customer_name text, program_name text, stamp_balance integer, reward_goal integer, available_rewards jsonb)
language sql security definer set search_path = public, app, auth
as $$
  select t.name, t.branding_mode, t.logo_url, t.primary_color, t.secondary_color, c.full_name, lp.name, coalesce(clb.stamp_balance, 0), lp.reward_stamp_goal,
    coalesce((select jsonb_agg(jsonb_build_object('name', r.name, 'description', r.description, 'expires_at', r.expires_at) order by r.created_at) from public.rewards r where r.customer_id = c.id and r.status = 'AVAILABLE'), '[]'::jsonb)
  from public.customer_cards cc join public.customers c on c.id = cc.customer_id join public.tenants t on t.id = cc.tenant_id
  left join public.customer_loyalty_balances clb on clb.customer_id = c.id left join public.loyalty_programs lp on lp.tenant_id = c.tenant_id and lp.status = 'ACTIVE'
  where cc.public_token = target_card_token and cc.status = 'ACTIVE' and c.status = 'ACTIVE' and t.status = 'ACTIVE';
$$;

revoke all on function app.get_public_web_card(text) from public, authenticated;
grant execute on function app.get_public_web_card(text) to anon;
