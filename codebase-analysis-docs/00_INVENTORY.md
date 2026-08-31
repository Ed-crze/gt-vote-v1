# GT-Vote — 00 INVENTORY (Run 1: Recon)

> Generated Run 1 of 2. Scope: enumerate and classify. No deep file analysis.
> Repo root: `gt-vote/` — all paths repo-relative.
> HEAD at time of scan: `0390dc7 fix: restore production inactivity timeouts`

---

## 1. Stack

| Fact | Value | Evidence |
|---|---|---|
| Framework | **Next.js `^16.2.11`** | `package.json:17` `[CONFIRMED]` |
| Router | **App Router** — `app/` only, no `pages/` | `git ls-files` — zero `pages/` entries `[CONFIRMED]` |
| Language | **TypeScript `^5`**, strict-ish; 3 root `.js` scripts | `package.json:34`, `tsconfig.json` `[CONFIRMED]` |
| React | `^18` (note: Next 16 normally pairs with React 19) | `package.json:20-21` `[CONFIRMED]` |
| Package manager | **npm** — `package-lock.json` present, no pnpm/yarn lock | root listing `[CONFIRMED]` |
| Styling | Tailwind `^3` + a **1,514-line hand-written** `app/globals.css` | `[CONFIRMED]` |
| Supabase | `@supabase/ssr ^0.9.0`, `@supabase/supabase-js ^2.100.1` | `package.json:12-13` `[CONFIRMED]` |
| Email | **nodemailer `^9.0.3`** → Brevo SMTP | `package.json:19` `[CONFIRMED]` |
| PDF | `jspdf ^4.2.1` (results export) | `package.json:15` `[CONFIRMED]` |
| Theming | `next-themes ^0.4.6` | `package.json:18` `[CONFIRMED]` |
| Deploy target | **Vercel**, region `lhr1` | `vercel.json:1-5` `[CONFIRMED]` |
| Tests | **NONE.** No test runner, no test script, no spec/test files anywhere. | `package.json:5-10` `[CONFIRMED]` |

### ⛔ Finding 0 — the database layer is not in this repository

**There is no `supabase/` directory.** No `supabase/migrations/`, no `supabase/config.toml`,
no seed SQL, no generated `database.types.ts`. Zero `.sql` files in the entire repo.
`[CONFIRMED — git ls-files, full-tree find for *.sql returned nothing]`

Consequence: **every RLS policy, the `submit_vote()` / `verify_receipt()` /
`get_receipt_for_session()` function bodies, all table DDL, all grants, and all triggers
live only in the hosted Supabase project and are not version-controlled here.**

The two "known prior issues" handed to this run — the TOCTOU race in `submit_vote()` and the
`WITH CHECK (true)` INSERT policy on `public.students` — **cannot be confirmed, denied, or
fixed from this repository.** Run 2 must treat them as unverifiable-from-source and the
report must say so. This is itself the single largest structural risk in the project: the
security model is undocumented, unreviewable, and unrecoverable if the Supabase project is
lost or misconfigured.

---

## 2. Directory map (two levels)

```
gt-vote/
├── app/                          Next.js App Router — all routes
│   ├── admin/                    Admin panel: login gate + 4 sub-pages (all client components)
│   ├── api/                      4 route handlers (the only server-side app code)
│   ├── auth/callback/            Supabase PKCE/OTP code-exchange handler
│   ├── ballot/                   ★ Vote casting UI + submit_vote RPC call
│   ├── candidates/               Candidate browsing (auth-gated)
│   ├── dashboard/                Voter home after login
│   ├── forgot-password/          Password reset request
│   ├── home/                     Public landing page
│   ├── login/                    Voter login
│   ├── register/                 Voter self-registration
│   ├── reset-password/           Password reset completion
│   ├── results/                  Live/published results
│   ├── verify/                   Receipt-code verification
│   ├── globals.css               1,514 lines of hand-written CSS (all page styling)
│   ├── layout.tsx                Root layout — ThemeProvider + SessionGuard
│   └── page.tsx                  Redirects / → /home
├── components/                   6 shared client components (nav, session guard, theme)
├── lib/                          Supabase clients, hashing, hooks, utils — 4 modules are DEAD
│   └── supabase/                 Browser client + cookie-based server client
├── public/                       Crest, campus bg, 5 sample manifesto PDFs
├── proxy.ts                      ★ Next 16 middleware (renamed) — route guards
├── cleanup.js / seed-*.js        ★ Root scripts using the SERVICE-ROLE key
└── codebase-analysis-docs/       This analysis
```

No `supabase/`, no `tests/`, no `scripts/`, no `types/`.

---

## 3. Supabase client instantiation — and every service-role use

| Client | File | Key used | Notes |
|---|---|---|---|
| **Browser** | `lib/supabase/client.ts:3-18` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `createBrowserClient`. Overrides the `navigator.locks` lock with a pass-through to dodge a multi-tab deadlock (`:9-16`). `[CONFIRMED]` |
| **Server (cookie)** | `lib/supabase/server.ts:5-30` | anon key | `createServerClient` over `next/headers` cookies. Forces `httpOnly: true`, `maxAge: 86400`. `[CONFIRMED]` |
| **Proxy/middleware** | `proxy.ts:7-30` | anon key | Separate `createServerClient`. **Deliberately does NOT set `httpOnly`** (comment `:17-21`) so the browser client can read the session from `document.cookie`. `[CONFIRMED]` |

### 🔑 SERVICE-ROLE KEY — every occurrence

| # | File | Context | Exposure |
|---|---|---|---|
| 1 | `app/api/stats/route.ts:12,29` | Public `/api/stats` GET. Bypasses RLS to count students + `voter_registry.has_voted` for the logged-out landing page. Returns aggregates only. | **Server-only, but the route is unauthenticated and un-rate-limited.** `[CONFIRMED]` |
| 2 | `seed-students.js:25` | Root CLI seeding script | Local/CI only `[CONFIRMED]` |
| 3 | `seed-votes.js:7` | Root CLI script — casts **synthetic votes at 75% turnout** via the real `submit_vote` RPC (`:109`) | Local/CI only. Points at whatever project `.env` names — **can pollute production.** `[CONFIRMED]` |
| 4 | `cleanup.js:6` | Deletes from `ballots`, `voter_registry`, `students` (`:18,23,37`) | Local/CI only. **Destructive, unguarded.** `[CONFIRMED]` |

No service-role key reaches client bundles. `[CONFIRMED — the only `SUPABASE_SERVICE_ROLE_KEY` reads are in route handlers and root .js scripts]`

---

## 4. Middleware, route handlers, server actions

### Middleware
`proxy.ts` (74 lines) — Next.js 16 renamed `middleware.ts` → `proxy.ts`; the exported
function is `proxy` (`:4`) with a `config.matcher` (`:67-73`) excluding static assets.
`[CONFIRMED file contents]` / `[ASSUMED that Next 16 auto-wires a root proxy.ts named export — not verified against a build]`

### Route handlers — 4 total, plus 1 auth callback
| Route | File | Auth | Notes |
|---|---|---|---|
| `GET /api/stats` | `app/api/stats/route.ts` (104) | **None** | Service-role. Public aggregates. |
| `POST /api/admin/verify` | `app/api/admin/verify/route.ts` (23) | Shared secret | `secretKey !== validKey` — non-constant-time `[CONFIRMED :9]` |
| `POST /api/send-vote-confirmation` | `.../route.ts` (77) | Supabase session | Email from session, never client `[CONFIRMED :13-16]` |
| `POST /api/send-reminders` | `.../route.ts` (169) | `app_metadata.role === 'admin'` `[CONFIRMED :65-68]` | Bulk email |
| `GET /auth/callback` | `app/auth/callback/route.ts` (24) | n/a | `exchangeCodeForSession` |

### Server actions
**ZERO.** No `'use server'` directive anywhere in the repo. `[CONFIRMED — grep over all .ts/.tsx]`

### Server components
Only `app/layout.tsx`, `app/page.tsx`, `components/PageBackground.tsx`,
`components/theme-provider.tsx`. **Every single route page is `'use client'`.** `[CONFIRMED]`

---

## 5. Environment variables (names only — no values read; `.env.local` never opened)

| Name | Public? | In `.env.example`? | Referenced |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | ✅ | clients, proxy, stats, next.config CSP |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | ✅ | all three clients |
| `NEXT_PUBLIC_SITE_URL` | yes | ✅ | `lib/auth-client.ts:26`, `send-reminders:8` |
| `SUPABASE_SERVICE_ROLE_KEY` | **no** | ✅ | stats route + 3 root scripts |
| `HASH_SALT` | **no** | ✅ | `lib/auth.ts:6`, `seed-votes.js:11` |
| `ADMIN_SECRET_KEY` | **no** | ✅ | `app/api/admin/verify/route.ts:7` |
| `NEXT_PUBLIC_HASH_SALT` | **yes** | ❌ **MISSING** | `lib/auth.ts:7` — see Finding 1 |
| `BREVO_SMTP_HOST` | no | ❌ **MISSING** | both email routes |
| `BREVO_SMTP_PORT` | no | ❌ **MISSING** | both email routes |
| `BREVO_SMTP_USER` | no | ❌ **MISSING** | both email routes |
| `BREVO_SMTP_PASS` | no | ❌ **MISSING** | both email routes |
| `BREVO_SENDER_EMAIL` | no | ❌ **MISSING** | both email routes |
| `BREVO_SENDER_NAME` | no | ❌ **MISSING** | both email routes |
| `NODE_ENV` | — | n/a | `next.config.js`, `lib/supabase/server.ts:24` |

`.env.example` is **7 of 14 variables out of date**. All six `BREVO_*` vars are destructured
(`const { BREVO_... } = process.env`) so they evade a naive `process.env.X` grep.
`[CONFIRMED]`

---

## 6. Database artefacts

| Artefact | Status |
|---|---|
| `supabase/migrations/` | **ABSENT** |
| `supabase/config.toml` | **ABSENT** |
| Seed SQL | **ABSENT** (JS seeders exist instead) |
| Generated DB types | **ABSENT** — every query is untyped `[CONFIRMED]` |

### Tables referenced from code (schema inferred from usage only)
`students`, `voter_registry`, `ballots`, `candidates`, `election_settings`

### RPCs called from code
| RPC | Called at |
|---|---|
| `submit_vote(p_student_id_hash, p_votes)` | `app/ballot/page.tsx:190`, `seed-votes.js:109` |
| `verify_receipt(...)` | `app/verify/page.tsx:50` |
| `get_receipt_for_session()` | `app/dashboard/page.tsx:142` |

### Storage buckets
`candidate-photos`, `candidate-manifestos` — written from the **browser** at
`app/admin/candidates/page.tsx:138-170` `[CONFIRMED]`

---

## 7. Dead code (imported by nothing)

`[CONFIRMED — repo-wide import grep]`

| File | Lines | Why it matters |
|---|---|---|
| `lib/store.ts` | 100 | Legacy localStorage auth. **Contains 3 hardcoded plaintext credentials** (`Admin123!`) and real student names/IDs (`:7-11`). |
| `lib/ratelimit.ts` | 57 | Login/register/verify rate limiters, fully written, **wired to nothing**. Also in-memory `Map` — would be per-instance and useless on Vercel anyway. |
| `lib/sanitize.ts` | 31 | Input sanitisers, fully written, **wired to nothing**. |
| `lib/auth-server.ts` | 23 | Server-side session/profile helpers, unused. |

Two of these four are **security controls that exist but are not connected.**

---

## 8. File index

`★` = touches the identity/ballot boundary.

### CRITICAL

| PRIORITY | PATH | TYPE | LINES | STATUS | PURPOSE |
|---|---|---|---|---|---|
| CRITICAL | `app/ballot/page.tsx` | client page ★ | 549 | QUEUED_R2 | Vote casting UI; hashes student ID in-browser, calls `submit_vote` RPC |
| CRITICAL | `lib/auth.ts` | util ★ | 13 | QUEUED_R2 | The **only** `hashStudentId`; 3-level salt fallback ending in a hardcoded literal |
| CRITICAL | `proxy.ts` | middleware | 74 | QUEUED_R2 | Route guards — admin gate appears unreachable (Finding 2) |
| CRITICAL | `lib/supabase/client.ts` | client factory | 18 | QUEUED_R2 | Anon-key browser client used by ~18 pages; custom lock override |
| CRITICAL | `lib/supabase/server.ts` | client factory | 30 | QUEUED_R2 | Cookie server client; cookie flags conflict with `proxy.ts` |
| CRITICAL | `lib/auth-client.ts` | auth ★ | 100 | QUEUED_R2 | Registration writes **both** `students` and `voter_registry` from the browser |
| CRITICAL | `app/api/stats/route.ts` | route handler | 104 | QUEUED_R2 | **Service-role**, unauthenticated, un-rate-limited |
| CRITICAL | `app/api/admin/verify/route.ts` | route handler | 23 | QUEUED_R2 | Admin third factor; `!==` compare, no rate limit |
| CRITICAL | `app/admin/settings/page.tsx` | client page ★ | 235 | QUEUED_R2 | **Deletes all ballots / resets registry from the browser** (`:124-125`) |
| CRITICAL | `app/verify/page.tsx` | client page ★ | 193 | QUEUED_R2 | `verify_receipt` RPC — receipt→ballot lookup surface |
| CRITICAL | `app/auth/callback/route.ts` | route handler | 24 | QUEUED_R2 | Code exchange; open-ish `next` param |
| CRITICAL | `app/admin/page.tsx` | client page | 197 | QUEUED_R2 | Admin login; role check client-side, `sessionStorage` flag |
| CRITICAL | `cleanup.js` | script | 85 | QUEUED_R2 | Service-role mass delete of ballots/registry/students |
| CRITICAL | `seed-votes.js` | script ★ | 144 | QUEUED_R2 | Service-role; casts synthetic votes through the real RPC |
| CRITICAL | `seed-students.js` | script | 131 | QUEUED_R2 | Service-role bulk student creation |
| CRITICAL | *(absent)* `supabase/migrations/**` | SQL | 0 | **UNKNOWN** | **All RLS + RPC logic is out-of-repo** |

### HIGH

| PRIORITY | PATH | TYPE | LINES | STATUS | PURPOSE |
|---|---|---|---|---|---|
| HIGH | `app/dashboard/page.tsx` | client page ★ | 667 | QUEUED_R2 | Voter home; joins `students` + `voter_registry`, `get_receipt_for_session` |
| HIGH | `app/admin/dashboard/page.tsx` | client page ★ | 453 | QUEUED_R2 | Tally + turnout; reads `ballots` and `students` from browser |
| HIGH | `app/admin/candidates/page.tsx` | client page | 648 | QUEUED_R2 | Candidate CRUD + storage uploads, all client-side |
| HIGH | `app/register/page.tsx` | client page ★ | 503 | QUEUED_R2 | Self-registration → eligibility |
| HIGH | `app/login/page.tsx` | client page | 434 | QUEUED_R2 | Voter login; reads `students` post-auth |
| HIGH | `app/results/page.tsx` | client page ★ | 291 | QUEUED_R2 | Reads `ballots` **directly from the browser** (`:76`) |
| HIGH | `app/admin/voters/page.tsx` | client page ★ | 172 | QUEUED_R2 | Lists `students` alongside `voter_registry` |
| HIGH | `app/api/send-reminders/route.ts` | route handler ★ | 169 | QUEUED_R2 | **Only server module joining identity→participation by re-hashing** |
| HIGH | `app/api/send-vote-confirmation/route.ts` | route handler | 77 | QUEUED_R2 | Post-vote email; deliberately content-free |
| HIGH | `components/SessionGuard.tsx` | client cmp | 229 | QUEUED_R2 | Global session/inactivity enforcement |
| HIGH | `lib/useInactivityTimeout.ts` | hook | 221 | QUEUED_R2 | Role-based timeout; localStorage-backed |
| HIGH | `app/reset-password/page.tsx` | client page | 316 | QUEUED_R2 | Password reset completion |
| HIGH | `app/forgot-password/page.tsx` | client page | 235 | QUEUED_R2 | Reset request |
| HIGH | `next.config.js` | CONFIG | 66 | QUEUED_R2 | CSP with `unsafe-eval` + `unsafe-inline`; placeholder redirect domain |
| HIGH | `lib/store.ts` | DEAD | 100 | DEPRECATED | Unused; hardcoded plaintext creds + real names |

### MEDIUM

| PRIORITY | PATH | TYPE | LINES | STATUS | PURPOSE |
|---|---|---|---|---|---|
| MEDIUM | `app/candidates/page.tsx` | client page | 330 | QUEUED_R2 | Candidate browsing; checks `election_settings` |
| MEDIUM | `app/home/page.tsx` | client page | 253 | CLASSIFIED | Public landing; consumes `/api/stats` |
| MEDIUM | `components/InactivityWarning.tsx` | client cmp | 250 | CLASSIFIED | Countdown modal |
| MEDIUM | `lib/generateResultsPDF.ts` | util | 170 | CLASSIFIED | jsPDF results export |
| MEDIUM | `components/AdminNav.tsx` | client cmp | 69 | CLASSIFIED | Admin nav + signout |
| MEDIUM | `components/TopNav.tsx` | client cmp | 55 | CLASSIFIED | Voter nav |
| MEDIUM | `lib/data.ts` | data | 54 | CLASSIFIED | Hardcoded candidate list w/ real UUIDs; still imported by admin dashboard |
| MEDIUM | `lib/ratelimit.ts` | DEAD | 57 | DEPRECATED | Unwired rate limiter |
| MEDIUM | `lib/sanitize.ts` | DEAD | 31 | DEPRECATED | Unwired sanitisers |
| MEDIUM | `lib/auth-server.ts` | DEAD | 23 | DEPRECATED | Unused server helpers |
| MEDIUM | `app/layout.tsx` | server cmp | 38 | CLASSIFIED | Root layout |
| MEDIUM | `lib/hooks.ts` | hook | 15 | CLASSIFIED | `useNavigate` fade transition |
| MEDIUM | `lib/types.ts` | types | 39 | CLASSIFIED | **Declares `interface Candidate` twice** (`:17,25`) |

### LOW / CONFIG / ASSETS

| PRIORITY | PATH | TYPE | LINES | STATUS | PURPOSE |
|---|---|---|---|---|---|
| LOW | `app/globals.css` | styles | 1514 | CLASSIFIED | All page styling, hand-written |
| LOW | `README.md` | docs | 513 | CLASSIFIED | Claims to verify in Run 2 |
| LOW | `vercel.json` | CONFIG | 40 | CONFIG | Headers; **no CSP here** (only in next.config) |
| LOW | `tailwind.config.ts` | CONFIG | 53 | CONFIG | Barely used given globals.css |
| LOW | `tsconfig.json` | CONFIG | 41 | CONFIG | Path alias `@/*` |
| LOW | `package.json` / `package-lock.json` | CONFIG | 36 / — | CONFIG | Lockfile excluded from analysis |
| LOW | `postcss.config.js`, `next-env.d.ts` | CONFIG | 6, 6 | CONFIG / GENERATED | Boilerplate |
| LOW | `app/page.tsx` | server cmp | 4 | CLASSIFIED | `redirect('/home')` |
| LOW | `components/PageBackground.tsx` | cmp | 11 | CLASSIFIED | Fade wrapper |
| LOW | `components/theme-provider.tsx` | cmp | 8 | CLASSIFIED | next-themes wrapper |
| LOW | `.env.example` | CONFIG | 8 | CONFIG | 7 vars out of date |
| LOW | `.gitignore` | CONFIG | — | CONFIG | Ignores `.env.local` ✅ |
| LOW | `public/gctu-crest.png`, `public/campus-bg.jpg` | STATIC_ASSET | — | STATIC_ASSET | Branding |
| LOW | `public/manifestos/*.pdf` (5) + `dummy-manifesto.html` | STATIC_ASSET | — | STATIC_ASSET | Sample manifestos for `lib/data.ts` candidates |
| LOW | `.vscode/settings.json`, `.claude/settings.local.json` | CONFIG | 2, 10 | CONFIG | Editor/tool local settings (`.claude/` untracked) |
| — | `tsconfig.tsbuildinfo` | GENERATED | — | GENERATED | Build cache, **tracked in git — should be ignored** |
| — | `node_modules/`, `.next/` | VENDOR | — | VENDOR | Excluded per rules |

**Files indexed: 56 source/config + 7 static assets + 2 excluded trees = 65 entries.**

---

## 9. UNKNOWN list

| Item | Why unknown | What it affects |
|---|---|---|
| All RLS policies | No SQL in repo; live only in hosted Supabase | **Everything.** Client-side anon-key access is the entire data layer — RLS is the only enforcement, and it is invisible here. |
| `submit_vote()` body | Not in repo | Cannot verify the TOCTOU claim, atomicity, or whether it links hash→ballot |
| `verify_receipt()` body | Not in repo | Cannot verify the receipt lookup leaks nothing |
| `get_receipt_for_session()` body | Not in repo | **Name implies it maps a session (identity) to a receipt (ballot)** — a potential boundary violation |
| `students` INSERT policy | Not in repo | Cannot verify the `WITH CHECK (true)` claim |
| Storage bucket policies | Not in repo | Browser uploads to `candidate-photos`/`candidate-manifestos` |
| Whether Next 16 wires `proxy.ts` | Not verified against a build | If unwired, **all route guards silently vanish** |
| `election_settings` shape/RLS | Inferred from selects only | Election open/close is the master switch |
| `tsconfig.tsbuildinfo` tracked | Present in git ls-files | Noise; may leak local paths |

---

## 10. Headline findings from recon

### Finding 1 — the hash salt is effectively public, and hashing happens in the browser
`lib/auth.ts:6-8`:
```ts
const salt = process.env.HASH_SALT || process.env.NEXT_PUBLIC_HASH_SALT || 'gt-vote-2025'
```
`hashStudentId` is imported by `lib/auth-client.ts` and called from
`app/ballot/page.tsx:79,188` — **client components**. In a browser bundle
`process.env.HASH_SALT` is not inlined (no `NEXT_PUBLIC_` prefix), so it is `undefined`.
The chain therefore resolves to `NEXT_PUBLIC_HASH_SALT` (public by definition, and absent
from `.env.example`) or to the **hardcoded literal `'gt-vote-2025'`**. `[CONFIRMED]`

Student IDs are numeric and the email is mechanically derived
(`${studentId}@live.gctu.edu.gh`, `lib/auth-client.ts:18`), so the ID space is enumerable.
An attacker who can read `voter_registry` can therefore compute `hash(id)` for any student
and determine **whether that named individual voted**. Whether they can read it depends
entirely on unreviewable RLS.

**The salted-hash anonymity claim is weaker than stated: the salt is not a secret.**

### Finding 2 — the admin route guard in `proxy.ts` looks unreachable
`proxy.ts:52` lists `'/admin'` in `publicRoutes`. `proxy.ts:56-58` tests
`publicRoutes.some(r => path.startsWith(r))` and returns early. `/admin/dashboard`
starts with `/admin`, so it returns before reaching the `adminRoutes` role check at
`proxy.ts:60-65` — **which is dead code for every path it lists.** `[CONFIRMED by reading
the control flow; runtime behaviour not executed]`

`'/api'` is in the same list, so no route handler gets proxy-level auth either (they do
their own checks — except `/api/stats`, which has none by design).

Admin access then rests on: the `ADMIN_SECRET_KEY` POST, a **client-side**
`app_metadata.role` check (`app/admin/page.tsx:76-84`), a `sessionStorage` flag
(`:87`), and RLS.

### Finding 3 — this is a client-side-first app; RLS is the entire security boundary
Every route page is `'use client'`. There are **zero server actions**. Admin CRUD, ballot
reads, results tallying, and even the destructive election reset
(`app/admin/settings/page.tsx:124-125`) execute in the browser with the anon key.

### Finding 4 — written-but-unwired security controls
`lib/ratelimit.ts` and `lib/sanitize.ts` are complete and imported by nothing. Login,
registration, and admin-key verification are all unthrottled.

---

*Run 1 · Phase A complete. Architecture in `01_ARCHITECTURE.md`.*
