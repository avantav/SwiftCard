# Monitoring And Backup Plan

## Application Monitoring

- Monitor `/api/health` from the deployment platform at a fixed interval.
- Alert on elevated HTTP 5xx responses, authentication failures, RPC errors, and sustained latency.
- Record deployment version, migration version, and branch commit in release metadata.
- Never include access tokens, service-role keys, phone numbers, or customer payloads in logs.

## Operational Events

- Review audit events for tenant suspension, branding changes, imports, purchases, cancellations, adjustments, redemptions, and reversals.
- Track import counts and errors without storing uploaded source files outside the approved retention boundary.
- Treat Wallet provider failures as non-blocking to Web Card availability.

## Database Backups

- Enable managed Supabase point-in-time recovery and scheduled backups for production.
- Verify backup retention, encryption, access ownership, and restoration permissions before pilot.
- Perform a restoration drill in a disposable project before production launch.
- Do not use `db reset`, destructive seed data, or remote `db push` as a backup strategy.

## Incident Response

- Define an owner and escalation contact before the pilot.
- Preserve audit records and migration history during incident investigation.
- Suspend affected tenant operations when required, then document the decision and recovery validation.
