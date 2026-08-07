# SwiftWallet Production Checklist

## Required Before Deployment

- [ ] Confirm production Supabase project and database backups.
- [ ] Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the secret manager.
- [ ] Confirm service-role key is server-only and absent from browser bundles.
- [ ] Configure production domain, HTTPS, and allowed redirect URLs.
- [ ] Review `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run db:verify-rls`, and `npm run build` results.
- [ ] Apply migrations only after local validation and explicit release approval.
- [ ] Confirm tenant, branch, staff, loyalty rules, branding, privacy notice, support contact, and timezone.

## Security And Privacy

- [ ] Test tenant A cannot read or modify tenant B.
- [ ] Test assigned-branch restrictions for Manager and Employee.
- [ ] Test shared branch JWT denial without PIN, PIN lockout/revocation, and individual actor attribution.
- [ ] Test suspended tenants and inactive staff cannot operate.
- [ ] Verify audit logs are append-only and accessible only by permitted roles.
- [ ] Confirm customer consent and privacy retention policy with the operator.
- [ ] Verify no secrets, service-role keys, or personal data are present in logs or Git.

## Wallet And Pilot

- [ ] Provide Apple Developer credentials and Google Wallet credentials through the secret manager.
- [ ] Test Web Card fallback with active and revoked cards.
- [ ] Validate Apple/Google passes on supported real devices.
- [ ] Execute the pilot E2E path: tenant, customer, scan, purchase, reward, redemption, cancellation, export, suspension.
- [ ] Record pilot acceptance owner, support process, rollback decision, and incident contact.

## Release Sign-Off

- [ ] Product owner approval.
- [ ] Security review approval.
- [ ] Database migration approval.
- [ ] Operations monitoring and backup verification.
- [ ] Pilot go/no-go decision.
