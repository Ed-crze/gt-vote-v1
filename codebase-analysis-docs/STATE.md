# GT-Vote — STATE (resumable)

```
INDEX_VERSION: 1
RUN: 1 (recon) — COMPLETE
SCANNED_AT_HEAD: 0390dc7 "fix: restore production inactivity timeouts"
```

**STACK_SUMMARY**
Next.js 16.2.11 App Router + React 18 + TypeScript, npm, deployed to Vercel (`lhr1`).
Supabase (Postgres/Auth/RLS/Storage) is the entire backend; Brevo SMTP via nodemailer for
email. Every one of the 15 route pages is a client component using the anon key — there
are **zero server actions**, only 5 route handlers and one middleware (`proxy.ts`), so RLS
is effectively the whole authorisation layer. **No `supabase/` directory exists: every RLS
policy and RPC body is out-of-repo and unreviewable.**

```
FILES_INDEXED: 65   (56 source/config, 7 static assets, 2 excluded trees)
QUEUED_FOR_RUN_2: 31
CLASSIFIED_NO_FURTHER_ANALYSIS: 25
DEPRECATED (dead code): 4
UNKNOWN: 9
TESTS: 0
```

---

## ARCHITECTURE_FINDINGS

1. **Client-side-first architecture.** All 15 pages are `'use client'`; 18 of 20 Supabase
   client instantiations run in the browser. Zero server actions. The Next.js layer is
   routing plus cosmetics; Postgres RLS is the security boundary. `[CONFIRMED]`
2. **The security model is not in the repository.** No `supabase/migrations/`, no
   `config.toml`, no `.sql` file anywhere. `submit_vote()`, `verify_receipt()`, and
   `get_receipt_for_session()` are called but never defined here. `[CONFIRMED]`
3. **Hashing happens in the browser, so the salt is public.** `lib/auth.ts:6-8` falls back
   `HASH_SALT` → `NEXT_PUBLIC_HASH_SALT` → literal `'gt-vote-2025'`. In a browser bundle
   the first is always undefined. `[CONFIRMED]`
4. **`proxy.ts` admin guard is unreachable.** `'/admin'` sits in `publicRoutes` (`:52`),
   and the early return at `:56-58` fires before the `adminRoutes` role check at `:60-65`.
   `[CONFIRMED]`
5. **Three route pages perform privileged writes from the browser**, including deleting
   every ballot (`app/admin/settings/page.tsx:124-125`). `[CONFIRMED]`
6. **Identity/ballot boundary is crossed in 7 modules**, most importantly
   `app/ballot/page.tsx` (hash + vote in one scope) and `app/api/send-reminders/route.ts`
   (deliberately reverses hash→student to pick non-voters). `[CONFIRMED]`
7. **Two complete security controls are wired to nothing**: `lib/ratelimit.ts` and
   `lib/sanitize.ts`. Login, registration, and the admin key check are all unthrottled.
   `[CONFIRMED]`
8. **Session cookies are intentionally not `httpOnly`** (`proxy.ts:17-21`) while the CSP
   permits `'unsafe-inline'` and `'unsafe-eval'` (`next.config.js:44-45`) — any XSS is a
   full session takeover. `proxy.ts` and `lib/supabase/server.ts` also set contradictory
   cookie flags. `[CONFIRMED]`
9. **Zero tests** in a system whose correctness determines an election outcome.
   `[CONFIRMED]`

---

## OPEN_QUESTIONS

1. What does `submit_vote()` actually do? Is the `has_voted` check atomic with the ballot
   insert? Is the hash persisted next to the vote? — **blocks any real security verdict.**
2. What does `get_receipt_for_session()` do? If it maps session → receipt → ballot row, the
   "no join" design property is dead.
3. What are the RLS policies on `ballots`? `app/results/page.tsx:76` and
   `app/admin/dashboard/page.tsx:127` read the table from the browser — is that scoped?
4. Can an authenticated voter read arbitrary rows of `voter_registry`? With a public salt
   that turns into "who voted" for every named student.
5. Does Next 16 actually wire a root `proxy.ts` with a named `proxy` export? If not,
   **every route guard silently disappears** and only RLS remains.
6. Is `NEXT_PUBLIC_HASH_SALT` set in the deployed environment? Either way the salt is
   public; this only decides whether it is also the hardcoded literal.
7. Does anything trust `auth.users.user_metadata` (client-writable) — `student_id_hash` is
   written there at signup (`lib/auth-client.ts:33`)?
8. What are the storage bucket policies for `candidate-photos` / `candidate-manifestos`,
   written directly from the browser?
9. Is the registration double-insert (`students` then `voter_registry`,
   `lib/auth-client.ts:64-80`) recoverable if the second fails?
10. Does `verify_receipt()` leak ballot contents to anyone holding a receipt code?

---

## KNOWN_RISKS

| # | Risk | Severity |
|---|---|---|
| R1 | RLS + RPC bodies absent from version control — unreviewable, unrecoverable | Critical |
| R2 | Public/hardcoded hash salt + browser-side hashing defeats the anonymity claim | Critical |
| R3 | `proxy.ts` admin guard unreachable (`/admin` in `publicRoutes`) | Critical |
| R4 | Browser-executable election reset (`DELETE FROM ballots`) | Critical |
| R5 | Vote eligibility enforced client-side; server enforcement unverifiable | High |
| R6 | Receipt bound to identity via user metadata + `get_receipt_for_session()` | High |
| R7 | Non-`httpOnly` session cookies + `unsafe-inline`/`unsafe-eval` CSP | High |
| R8 | Rate limiting and sanitisation written but unwired | High |
| R9 | Zero tests | High |
| R10 | `/api/stats` — service role, unauthenticated, unthrottled | Medium |
| R11 | Non-constant-time, unthrottled admin secret compare | Medium |
| R12 | `seed-votes.js` / `cleanup.js` can target production with service role | Medium |
| R13 | Dead `lib/store.ts` ships plaintext passwords + real student names | Medium |
| R14 | Contradictory cookie flags between proxy and server client | Medium |
| R15 | No generated DB types; all queries untyped | Medium |
| R16 | `.env.example` missing 7 of 14 vars (all `BREVO_*`, `NEXT_PUBLIC_HASH_SALT`) | Low |
| R17 | `tsconfig.tsbuildinfo` tracked in git | Low |

---

## RUN_2_QUEUE

> Ordered so the first ten entries are the ten that most determine whether this system is
> actually secure.

### TIER_1_SECURITY_CRITICAL

1. **`supabase/migrations/**` — DOES NOT EXIST.** First action of Run 2: attempt to
   recover the live schema (`supabase db pull`, dashboard export, or ask the owner) for
   `submit_vote`, `verify_receipt`, `get_receipt_for_session`, all RLS policies, grants,
   and storage policies. *Nothing else in this queue can be concluded without it.*
2. **`lib/auth.ts` (13)** — the whole boundary rests here. Confirm salt resolution in the
   built client bundle; grep `.next/static` for `gt-vote-2025`. Quantify hash reversibility
   against the enumerable student-ID space.
3. **`app/ballot/page.tsx` (549)** — the critical crossing: client-side eligibility check,
   in-browser hashing, `submit_vote` call, receipt handling. Read `:60-215` closely.
4. **`proxy.ts` (74)** — prove or disprove the unreachable admin branch; confirm Next 16
   actually loads this file; check `publicRoutes` ordering and the `/api` bypass.
5. **`app/admin/settings/page.tsx` (235)** — browser-side `DELETE FROM ballots` and
   registry reset at `:120-130`. Determine what stops a non-admin from issuing it.
6. **`lib/auth-client.ts` (100)** — registration double-insert, `student_id_hash` into
   client-writable user metadata (`:33`), receipt→identity write (`:89-93`).
7. **`app/dashboard/page.tsx` (667)** — `get_receipt_for_session()` (`:142`) plus the
   `students` + `voter_registry` reads. The suspected identity→ballot path.
8. **`app/api/stats/route.ts` (104)** — unauthenticated service-role endpoint; confirm only
   aggregates escape and assess enumeration/DoS.
9. **`lib/supabase/client.ts` (18) + `lib/supabase/server.ts` (30)** — the cookie-flag
   contradiction with `proxy.ts`; the `navigator.locks` override and its concurrency
   implications for `getUser()`.
10. **`app/api/admin/verify/route.ts` (23)** — timing-safe comparison, rate limiting,
    and whether a `sessionStorage` flag is load-bearing anywhere.

### TIER_2_CORE_BUSINESS_LOGIC

11. `app/verify/page.tsx` (193) — `verify_receipt` surface; what a receipt code discloses.
12. `app/results/page.tsx` (291) — direct browser read of `ballots`; publication gating.
13. `app/admin/dashboard/page.tsx` (453) — tallying correctness; browser-side `ballots` read.
14. `app/api/send-reminders/route.ts` (169) — bulk email; the deliberate hash→identity
    reversal at `:104-120`; N+1 hashing over the full student roll.
15. `app/register/page.tsx` (503) — eligibility gate, duplicate detection, validation
    (note: `lib/sanitize.ts` is not used here).
16. `app/login/page.tsx` (434) — credential handling, enumeration, absent rate limiting.
17. `app/admin/candidates/page.tsx` (648) — CRUD + browser storage uploads; file-type and
    size validation.
18. `app/admin/page.tsx` (197) — three-factor admin login; client-side role check.
19. `components/SessionGuard.tsx` (229) + `lib/useInactivityTimeout.ts` (221) — the three
    most recent commits touch this; verify timeout enforcement is not purely client-side.
20. `app/auth/callback/route.ts` (24) — `next` param redirect handling.

### TIER_3_SUPPORTING

21. `app/reset-password/page.tsx` (316) + `app/forgot-password/page.tsx` (235)
22. `app/candidates/page.tsx` (330) — election-settings gating
23. `next.config.js` (66) — CSP `unsafe-*`, placeholder redirect domain, image patterns
24. `cleanup.js` (85), `seed-votes.js` (144), `seed-students.js` (131) — service-role scripts
25. `lib/store.ts` (100) — **recommend deletion**; plaintext creds and real names
26. `lib/ratelimit.ts` (57) + `lib/sanitize.ts` (31) — wire up or delete
27. `lib/auth-server.ts` (23) — unused; delete or adopt
28. `lib/data.ts` (54) + `lib/types.ts` (39) — hardcoded candidates still imported by the
    admin dashboard; duplicate `Candidate` interface (`types.ts:17,25`)
29. `lib/generateResultsPDF.ts` (170) — result export fidelity
30. `vercel.json` (40) — header overlap with `next.config.js`; no CSP here
31. `README.md` (513) — reconcile its claims against findings; it documents `HASH_SALT` as
    "server only", which the code contradicts

---

## CONTRADICTIONS_WITH_STATED_DESIGN

1. **"Supabase migrations / RLS in the repo" — FALSE.** There is no `supabase/` directory
   and not a single `.sql` file. The stated known issues (TOCTOU in `submit_vote()`,
   `WITH CHECK (true)` on `public.students`) **cannot be verified or remediated from this
   repository at all.** They are neither confirmed nor denied by Run 1. `[CONFIRMED absence]`

2. **"Voter identity is structurally decoupled via *salted* SHA-256" — MATERIALLY WEAKER
   THAN CLAIMED.** The salt is not secret: hashing runs in client components
   (`app/ballot/page.tsx:79`) via `lib/auth.ts`, whose fallback chain ends at the literal
   `'gt-vote-2025'`. `README.md:410` documents `HASH_SALT` as "Server only", which the code
   contradicts. Student IDs are enumerable and emails are derived from them
   (`lib/auth-client.ts:18`), so hash→student is a lookup table —
   `app/api/send-reminders/route.ts:104-120` performs exactly that reversal in production.
   `[CONFIRMED]`

3. **"There is deliberately no join between `voter_registry` and `ballots`" — TABLE SHAPE
   PLAUSIBLE, BUT A SECOND PATH EXISTS.** No FK is implied by the call signatures, but the
   receipt code is written onto the identity record (`lib/auth-client.ts:89-93`) and
   `get_receipt_for_session()` (`app/dashboard/page.tsx:142`) maps an authenticated session
   to a receipt. If receipt→ballot resolves, the join is reconstituted through the receipt
   rather than the hash. `[CONFIRMED that the link is created; [UNKNOWN] where it ends]`

4. **Implied "middleware protects admin routes" — FALSE.** `proxy.ts:52` puts `'/admin'`
   in `publicRoutes`, and `:56-58` returns before the role check at `:60-65`. The admin
   guard is dead code. `[CONFIRMED]`

5. **Implied "server-mediated data access" — FALSE.** There are no server actions and only
   5 route handlers. Vote submission, results, admin CRUD, and ballot deletion all run in
   the browser under the anon key. `[CONFIRMED]`

6. **`README.md` describes rate limiting and input sanitisation as part of the system** —
   both modules exist and are imported by nothing. `[CONFIRMED]`

---

*Run 1 complete. Run 2 starts at TIER_1 item 1: recover the database schema.*
