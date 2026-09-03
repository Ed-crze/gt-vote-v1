# Database migrations

**These migrations have already been applied. This folder is a record, not a queue.**

Nothing here is pending, and nothing runs automatically. Every statement in this
folder was executed **manually, statement by statement, in the Supabase SQL
editor** against the live project (`zclmliceahyjshfiacgx`). No automated
migration tool — no Supabase CLI, no `supabase db push`, no Prisma, no Drizzle —
is wired into this project. Do not point one at this folder expecting it to
reconcile state.

The folder exists so the remediation is reviewable: what was changed, when, and
why. That record is the point.

## Order applied

| # | File | Applied | Status |
|---|------|---------|--------|
| — | *(earlier corrective migration — **not in this repo**, see below)* | before 2026-09-03 | applied, unrecorded |
| 1 | `2026-09-03_frontend-realignment-and-hardening.sql` | 2026-09-03 | applied |

Within `2026-09-03_frontend-realignment-and-hardening.sql`, the four sections
were applied in the order **D → B → C**, with A alongside — not in alphabetical
order. D went first because it was the only section fixing a live data-correctness
bug rather than restoring a capability.

## The missing first migration

The earlier corrective migration — the one that introduced the private hash
helper, replaced `submit_vote(p_student_id_hash, p_votes)` with the
single-argument `submit_vote(p_votes)` deriving identity from `auth.uid()`,
dropped `get_receipt_for_session()`, and tightened RLS on `students`, `ballots`
and `voter_registry` — **does not exist anywhere in this repository.** It was
never committed; a search of the full git history finds no `.sql` file has ever
been added to this project.

That migration is the security fix. The file in this folder only completes it.
A remediation record that contains the follow-up but not the original reads
backwards, so recovering it from the Supabase SQL editor history and adding it
here with an earlier date would make the two read in sequence.

## Why each migration exists

### `2026-09-03_frontend-realignment-and-hardening.sql`

The earlier migration moved voter identity server-side and tightened RLS, but
the frontend was never updated to match. Vote submission failed outright, and
several reads silently returned nothing rather than erroring. Most of that
repair was frontend work; this file is the part that had to happen in the
database.

- **Section A — replay protection.** Re-adds an optional `p_request_id` nonce to
  `submit_vote`, plus a `vote_requests` ledger keyed on `(server-derived voter
  hash, nonce)`. A retried request after a dropped response returns the original
  receipt instead of creating a second ballot. The nonce is a client-generated
  value, not an identity claim — the voter is still derived from `auth.uid()`,
  so this does not weaken the server-derived-identity design.

- **Section B — `fk_students_user`.** The earlier migration dropped this foreign
  key inside its positions section with no explanation, which broke
  `ON DELETE CASCADE`. `cleanup.js` depends on that cascade to remove dummy
  `students` rows when their auth users are deleted. Restored with the cascade.
  **No cascade was added to `voter_registry`**, deliberately: cascading deletes
  there would make account deletion a re-vote path.

- **Section C — dead INSERT policy.** Removes `students: insert own profile`,
  which no longer had a caller once `createStudentProfile()` was deleted from
  `lib/auth-client.ts`. This is dead-surface removal, **not** a security fix —
  an earlier reading of `pg_policies.qual` as `null` suggested an unrestricted
  `WITH CHECK`, but `qual` is `null` for every INSERT policy by design, and the
  policy was correctly scoped to `auth.uid() = id` all along. The file records
  that correction rather than hiding it.

- **Section D — `get_non_voter_emails()`.** The highest-priority item.
  `/api/send-reminders` re-derived each student's identity hash in Node using
  `NEXT_PUBLIC_HASH_SALT`, while the database derives it from a pepper in the
  `private` schema. Two different peppers, so no hash ever matched, so the
  "closing" reminder's has-voted filter excluded nobody — it **failed open**,
  with no error. Measured against live data before the fix: **zero** of the
  client-derived hashes matched any `voter_registry` row. This section moves the
  hashing in-database, where the pepper lives, so the two cannot diverge again.

## Caveat on fidelity

Two blocks in the SQL file are **templates, not the text that was executed**, and
are marked inline with `⚠ TEMPLATE MARKER`:

- **A2** carries a `>>> PASTE YOUR EXISTING BODY HERE <<<` marker where
  `submit_vote`'s real body was supplied at run time.
- **D2** calls `private.hash_student_id(...)`, a placeholder; the applied version
  used the project's actual hash helper.

Until those are filled in, the file documents the *shape* of what was applied
rather than its exact text. Recover the applied definitions with:

```sql
SELECT pg_get_functiondef('public.submit_vote(jsonb,uuid)'::regprocedure);
SELECT pg_get_functiondef('public.get_non_voter_emails()'::regprocedure);
```

## Conventions

- Filenames: `YYYY-MM-DD_short-kebab-description.sql`
- Every file opens with a header recording status, date applied, project ref,
  what it fixes, and whether it is safe to re-run.
- Project refs may appear; **credentials, keys, connection strings and pepper
  values must never** — they are not present in any file here.
- Verification `SELECT`s are kept alongside the statements they verify. They are
  read-only and safe to re-run at any time to confirm current state.
