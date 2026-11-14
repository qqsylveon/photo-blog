# Alibaba Cloud CDN Certificate Automation Implementation Plan

> Execute natively in the existing linked worktree. Use test-driven-development and verification-before-completion.

**Goal:** Automate DNS validation, renewal, and CDN deployment for img.qqsylveon.love on Ubuntu 22.04 with Snap Certbot 5.10.

**Architecture:** Keep the installed Certbot. External Python hooks use Alibaba Cloud's official OpenAPI and Credentials SDKs with the ECS instance role (IMDSv2). Certbot's existing scheduler handles renewal; a separate timer reconciles the local production certificate with CDN and retries failed deployments.

**Tech Stack:** Python 3.10+, Snap Certbot, Alibaba Cloud SDK, cryptography, dnspython, systemd.

**Spec:** The design and global constraints in this document, following the user's confirmed ECS and Certbot environment.

## Design and approaches

The user requested complete automation, already issued the certificate with manual DNS, and supplied Ubuntu/Snap versions. Replacing Certbot or saving permanent AccessKeys is unnecessary. Keep manual authentication but add auth/cleanup hooks backed by the instance role, and add a certificate deployment hook. Do not change the demo certificate, Nginx, DNS routing, website runtime, or media integration.

## Global constraints

- Only img.qqsylveon.love is supported; the DNS zone is qqsylveon.love.
- Do not read cloud secrets locally or call live cloud write APIs during development.
- Delete only TXT records created by this hook for the current challenge; preserve other records.
- Verify the certificate chain against system trust, hostname, validity, and private-key match before uploading; staging and self-signed certificates must fail.
- Never pass certificate/private-key contents through process arguments or log raw SDK exceptions.
- Use ECS instance-role credentials with IMDSv1 disabled.
- A CDN deployment failure must remain retryable even when Certbot no longer needs to renew.
- Keep all existing Certbot installations, certificate lineages, schedulers, and application code.

## Review focus

- Existing TXT records, repeated cleanup, and validation failures must not damage unrelated DNS.
- A hook for demo.qqsylveon.love must not update the image CDN.
- Test/staging certificates, mismatched keys, and older local certificates must never replace the live certificate.
- Repeated sync must be harmless and must not hide a failed cloud upload.
- SDK errors may contain request bodies and secrets; CLI failures must redact them.

## Tasks

1. [x] Write and run failing offline tests for DNS ownership/cleanup, certificate validation, deployment idempotency/retry, and error redaction.
2. [x] Implement the external hooks and test the actual official SDK POST transport with fabricated credentials.
3. [x] Add restricted RAM policy, reconciliation systemd units, installation/reconfiguration/rollback documentation, and a README link.
4. [x] Run the operations tests, Python 3.10 syntax check, dependency checks, repository tests, and diff review; record the lack of live ECS validation.

## Verification

- 27 offline operations tests passed, including actual SDK request serialization/logging and a second-process deployment-lock check.
- Existing application suite: 30 files / 125 tests passed, both baseline and final.
- Python 3.10 syntax, direct dependency Python compatibility, RAM policy JSON, pip dependency checks, and git diff whitespace checks passed.
- Independent review found and verified fixes for concurrent deployment rollback, inherited SDK debug logging, and interactive reconfigure behavior.
- Tests ran on Windows with Python 3.12 and simulated cloud transport. Linux flock, systemd execution, ECS role permissions, real DNS propagation, and live CDN deployment still require the documented target-server acceptance steps.
