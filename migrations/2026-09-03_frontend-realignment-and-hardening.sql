-- ════════════════════════════════════════════════════════════════════════════
-- GT-Vote — frontend realignment and hardening
--
-- STATUS         APPLIED — do not re-run. See "Re-running" below.
-- DATE APPLIED   2026-09-03
-- PROJECT REF    zclmliceahyjshfiacgx  (Supabase project subdomain; no
--                credentials, keys or connection strings appear in this file)
-- APPLIED BY     Manually, statement by statement, in the Supabase SQL editor.
--                No automated migration tool was used.
-- ORDER APPLIED  D -> B -> C  (Section A applied alongside; see each section)
--
-- WHAT THIS FIXES
--   An earlier corrective migration moved voter identity server-side: it
--   replaced submit_vote(p_student_id_hash, p_votes) with submit_vote(p_votes),
--   deriving the voter from auth.uid() instead of trusting a client-supplied
--   hash; it dropped get_receipt_for_session() so ballot receipts became
--   deliberately unrecoverable; and it tightened RLS on students, ballots and
--   voter_registry to own-row and admin-only. That migration was correct, but
--   the frontend was never updated to match, so vote submission failed outright
--   and several reads silently returned nothing. This file completes that work
--   on the database side: it restores replay protection to submit_vote so a
--   retried request after a dropped response returns the original receipt
--   rather than a second ballot (A); restores the students -> auth.users
--   foreign key with ON DELETE CASCADE, which the earlier migration dropped
--   without explanation, breaking dummy-account cleanup (B); removes a dead
--   INSERT policy on students left with no caller (C); and replaces a
--   Node-side re-hash in /api/send-reminders that silently failed open with a
--   SECURITY DEFINER function that hashes in-database where the pepper lives
--   (D). D was the most urgent: measured against live data, zero client-derived
--   hashes matched any registry row, so the "you have not voted" reminder
--   filter excluded nobody.
--
-- RE-RUNNING
--   Do not re-run this file as a whole. Sections A, C and D are idempotent in
--   form (CREATE OR REPLACE, DROP ... IF EXISTS, CREATE TABLE IF NOT EXISTS),
--   but Section B's ALTER TABLE ... ADD CONSTRAINT will error if the
--   constraint already exists, and Section A's A3 drops a function that no
--   longer exists. The verification SELECTs in every section are read-only and
--   safe to re-run at any time to confirm current state.
--
-- ⚠ FIDELITY NOTE — READ BEFORE CITING THIS FILE AS A RECORD
--   Two blocks below are TEMPLATES, not the text that was executed:
--     • A2 contains the marker ">>> PASTE YOUR EXISTING BODY HERE <<<" in
--       place of submit_vote's real body, which had to be supplied at run time.
--     • D2 calls private.hash_student_id(...), a placeholder name. The applied
--       version used the project's actual hash helper.
--   Recover both from the live database and paste them in, so this file
--   matches what actually ran:
--     SELECT pg_get_functiondef('public.submit_vote(jsonb,uuid)'::regprocedure);
--     SELECT pg_get_functiondef('public.get_non_voter_emails()'::regprocedure);
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION A — replay protection (idempotency)          [APPLIED 2026-09-03]
-- ════════════════════════════════════════════════════════════════════════════
--
-- Verified after applying: A4 returned exactly one row,
-- submit_vote(jsonb,uuid) returning text.
--
-- Why this is safe with server-derived identity:
--   p_request_id is a client-generated nonce, NOT an identity claim. The voter
--   is still derived from auth.uid() exactly as the corrective migration
--   intended. The nonce only answers "have I already processed THIS submission
--   from THIS voter?" — it cannot be used to vote as anyone else, because the
--   replay row is keyed on the server-derived voter hash as well as the nonce.
--
-- STEP A0 — read the current function body first and keep a copy.
--   Everything below assumes you are re-creating submit_vote with its existing
--   body plus a replay check. Do not run A2 until you have pasted your current
--   body into it.

-- ── A0. Dump the current definition so you can paste it into A2 ─────────────
SELECT pg_get_functiondef(p.oid)
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public'
AND    p.proname = 'submit_vote';


-- ── A1. The replay ledger ───────────────────────────────────────────────────
-- One row per (voter, nonce). Holds the receipt that submission produced so a
-- retry can return the original instead of raising ALREADY_VOTED.
CREATE TABLE IF NOT EXISTS public.vote_requests (
  voter_hash   text        NOT NULL,
  request_id   uuid        NOT NULL,
  receipt_code text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (voter_hash, request_id)
);

-- No direct client access — only the SECURITY DEFINER function touches it.
ALTER TABLE public.vote_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vote_requests FROM anon, authenticated;

COMMENT ON TABLE public.vote_requests IS
  'Idempotency ledger for submit_vote. Maps (server-derived voter hash, client nonce) '
  'to the receipt that submission returned, so a retried request after a dropped '
  'response returns the original receipt instead of creating a second ballot. '
  'Deliberately NOT linked to ballots — it stores no vote content.';


-- ── A2. submit_vote with an optional nonce ──────────────────────────────────
-- IMPORTANT: this is a SINGLE function with a DEFAULT, not an overload.
-- Two functions (one with the nonce, one without) would make the
-- submit_vote(p_votes => ...) call ambiguous to PostgREST and break voting.
--
-- Replace the marked block with YOUR CURRENT BODY from A0. The only additions
-- are (a) the p_request_id parameter, (b) the replay lookup near the top, and
-- (c) the ledger insert just before the receipt is returned.

CREATE OR REPLACE FUNCTION public.submit_vote(
  p_votes      jsonb,
  p_request_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voter_hash text;
  v_receipt    text;
BEGIN
  -- Identity stays server-derived. Replace this with however your current
  -- function resolves auth.uid() -> the voter's registry hash.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT s.student_id_hash INTO v_voter_hash
  FROM   public.students s
  WHERE  s.id = auth.uid();

  -- ── REPLAY CHECK ──────────────────────────────────────────────────────
  -- Runs before every other check so a retry is answered identically even
  -- once voting has closed.
  IF p_request_id IS NOT NULL AND v_voter_hash IS NOT NULL THEN
    SELECT vr.receipt_code INTO v_receipt
    FROM   public.vote_requests vr
    WHERE  vr.voter_hash = v_voter_hash
    AND    vr.request_id = p_request_id;

    IF v_receipt IS NOT NULL THEN
      RETURN v_receipt;   -- same submission, same answer
    END IF;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- ⚠ TEMPLATE MARKER — this is NOT the text that was executed. The real
  --   body was supplied at run time from A0's output. Recover it with:
  --   SELECT pg_get_functiondef('public.submit_vote(jsonb,uuid)'::regprocedure);
  -- >>> PASTE YOUR EXISTING BODY HERE, UNCHANGED <<<
  --     the NO_VOTES_SUBMITTED / ELECTION_CLOSED / NOT_REGISTERED /
  --     ALREADY_VOTED_OR_NOT_REGISTERED / INVALID_CANDIDATE checks, the
  --     ballot inserts, the registry update, and the receipt generation.
  --     It must end with the receipt assigned to v_receipt.
  -- ══════════════════════════════════════════════════════════════════════

  -- ── LEDGER WRITE ──────────────────────────────────────────────────────
  -- Same transaction as the ballot insert: either both land or neither does.
  IF p_request_id IS NOT NULL THEN
    INSERT INTO public.vote_requests (voter_hash, request_id, receipt_code)
    VALUES (v_voter_hash, p_request_id, v_receipt)
    ON CONFLICT (voter_hash, request_id) DO NOTHING;
  END IF;

  RETURN v_receipt;
END;
$$;

-- Same grants the corrective migration gave the one-argument version.
REVOKE ALL     ON FUNCTION public.submit_vote(jsonb, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.submit_vote(jsonb, uuid) TO authenticated;


-- ── A3. Drop the old one-argument function ──────────────────────────────────
-- Run this ONLY after A2 succeeds and you have tested a vote. Leaving both in
-- place makes submit_vote(p_votes => ...) ambiguous.
-- DROP FUNCTION IF EXISTS public.submit_vote(jsonb);

-- ── A4. Verify exactly one submit_vote remains ──────────────────────────────
-- Run this BEFORE A2 (expect one row: submit_vote(jsonb)) and again AFTER A3.
SELECT p.oid::regprocedure                        AS signature,
       pg_get_function_identity_arguments(p.oid)  AS args,
       pg_get_function_result(p.oid)              AS returns
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public' AND p.proname = 'submit_vote';
--
-- EXPECTED AFTER A2 + A3 — exactly ONE row, with two arguments:
--   signature : submit_vote(jsonb,uuid)
--   args      : p_votes jsonb, p_request_id uuid DEFAULT NULL
--   returns   : text
--
-- TWO ROWS is a half-applied state. PostgREST resolves an RPC by the SET OF
-- ARGUMENT NAMES sent, so with both functions present:
--   • a call sending {p_votes, p_request_id} matches only the 2-arg function —
--     unambiguous. app/ballot/page.tsx sends both on its first attempt, so
--     VOTING KEEPS WORKING during this window.
--   • a call sending {p_votes} alone matches BOTH (the 2-arg one has a
--     default) — ambiguous, PGRST203. seed-votes.js:100 sends only p_votes,
--     so SEEDING BREAKS. The ballot page's fallback only triggers on PGRST202,
--     so it never reaches that path.
-- Not an outage, but do not leave it half-applied. Run A3's DROP:
--   DROP FUNCTION IF EXISTS public.submit_vote(jsonb);


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION B — restore fk_students_user (students.id -> auth.users.id)
--                                                      [APPLIED 2026-09-03]
-- ════════════════════════════════════════════════════════════════════════════
--
-- Verified after applying: B4 confirmed fk_students_user with confdeltype 'c'
-- (ON DELETE CASCADE). Orphan checks B1/B2 were run first and were clear.
--
-- The corrective migration dropped this inside its positions section with no
-- explanation, which broke ON DELETE CASCADE. cleanup.js relies on that
-- cascade: it deletes auth users and expects the students rows to follow.

-- ── B1. Orphan check — students whose auth user no longer exists ────────────
-- Adding the constraint FAILS while any of these exist. Expect 0 rows.
SELECT s.id, s.student_id, s.full_name, s.email
FROM   public.students s
LEFT   JOIN auth.users u ON u.id = s.id
WHERE  u.id IS NULL
ORDER  BY s.email;

-- ── B2. Orphan count — the same check as a single number ────────────────────
SELECT count(*) AS orphaned_students
FROM   public.students s
WHERE  NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.id);

-- If B1/B2 return rows, decide deliberately before deleting anything: these
-- are students with no login. To remove only the dummy ones:
--   DELETE FROM public.students s
--   WHERE  s.email LIKE '%@dummy.gctu.edu.gh'
--   AND    NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.id);

-- ── B3. Restore the constraint ──────────────────────────────────────────────
ALTER TABLE public.students
  ADD CONSTRAINT fk_students_user
  FOREIGN KEY (id) REFERENCES auth.users (id)
  ON DELETE CASCADE;

-- ── B4. Confirm it exists ───────────────────────────────────────────────────
SELECT conname, confdeltype   -- confdeltype 'c' = ON DELETE CASCADE
FROM   pg_constraint
WHERE  conrelid = 'public.students'::regclass
AND    conname  = 'fk_students_user';


-- ── DO NOT ADD A CASCADE TO voter_registry ──────────────────────────────────
-- voter_registry must stay decoupled from auth.users. If deleting an auth user
-- also deleted that voter's registry row, account deletion would become a
-- re-vote path: delete the account, register again, vote again. The registry
-- is intentionally an orphaned participation record — that is what makes
-- "has already voted" survive account deletion.


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION C — drop the now-dead "students: insert own profile" INSERT policy
--                                                      [APPLIED 2026-09-03]
-- ════════════════════════════════════════════════════════════════════════════
--
-- CORRECTION (measured 2026-09-03, C1 output below). This section originally
-- assumed the INSERT policy had an unrestricted WITH CHECK. It does not. The
-- policy already reads WITH CHECK (auth.uid() = id) and applies only to
-- {authenticated}. There was never an arbitrary-insert surface.
--
-- The null value seen earlier in pg_policies.qual is expected and harmless:
-- INSERT policies have no USING clause, only WITH CHECK, so qual is null for
-- every INSERT policy by design. Read polwithcheck, not polqual.
--
-- So this section is no longer a security fix — it is dead-surface removal.
-- No browser code inserts into students any more (createStudentProfile() was
-- deleted, and it was the only caller), so the policy protects a path nobody
-- takes. Low stakes; worth doing while the migration window is open.
--
-- Run this AFTER Section B.
--
-- C1 MEASURED OUTPUT — confirms the trigger does not need the policy:
--   C1a  handle_new_user | is_security_definer: true | owner: postgres
--                        | owner_is_superuser: false | owner_bypasses_rls: true
--   C1b  students | rls_enabled: true | rls_forced_on_owner: false
--                 | table_owner: postgres
--   C1c  "students: insert own profile" | polcmd: a
--                 | with_check_expr: (auth.uid() = id) | applies_to: {authenticated}
--
--   Reading: SECURITY DEFINER, owner bypasses RLS, and students does not force
--   RLS on its owner — so handle_new_user() inserts with RLS bypassed and
--   dropping the policy cannot break signup. Option 1 is confirmed safe.
--
-- The C1 queries are kept below so the conclusion can be re-verified after any
-- future migration touches the trigger or the table.

-- ── C1a. Is the trigger function SECURITY DEFINER, and who owns it? ─────────
SELECT p.proname,
       p.prosecdef                    AS is_security_definer,
       pg_get_userbyid(p.proowner)    AS owner,
       r.rolsuper                     AS owner_is_superuser,
       r.rolbypassrls                 AS owner_bypasses_rls
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
JOIN   pg_roles     r ON r.oid = p.proowner
WHERE  p.proname = 'handle_new_user';

-- ── C1b. Does students force RLS even against its own owner? ────────────────
SELECT c.relname,
       c.relrowsecurity               AS rls_enabled,
       c.relforcerowsecurity          AS rls_forced_on_owner,
       pg_get_userbyid(c.relowner)    AS table_owner
FROM   pg_class c
WHERE  c.oid = 'public.students'::regclass;

-- ── C1c. Which roles the current INSERT policy actually applies to ──────────
SELECT polname,
       polcmd,
       pg_get_expr(polwithcheck, polrelid) AS with_check_expr,
       ARRAY(SELECT pg_get_userbyid(x) FROM unnest(polroles) AS x) AS applies_to
FROM   pg_policy
WHERE  polrelid = 'public.students'::regclass;
--
-- HOW TO READ C1:
--   handle_new_user() does NOT depend on the permissive policy when C1a shows
--   is_security_definer = true AND either owner_bypasses_rls / owner_is_superuser
--   is true, OR (owner = table_owner from C1b AND rls_forced_on_owner = false).
--   In that case the trigger inserts as the function owner with RLS bypassed,
--   and the policy exists only for browser callers — so tightening it cannot
--   break signup.
--
--   If C1c shows the policy applies to a role the trigger runs as (rather than
--   just 'authenticated'), stop and re-check before running C2.


-- ── C2. Drop the dead INSERT policy  (OPTION 1 — confirmed safe by C1) ──────
-- Removes the browser INSERT path entirely. Registration rows are created by
-- handle_new_user(), which bypasses RLS; the only client-side caller was
-- createStudentProfile() in lib/auth-client.ts, now deleted.
DROP POLICY IF EXISTS "students: insert own profile" ON public.students;

-- OPTION 2 — NOT NEEDED, kept only for reference. This recreates the policy
-- exactly as it already exists today. Use it only if you decide to keep a
-- browser INSERT path after all.
--
--   CREATE POLICY "students: insert own profile"
--     ON public.students
--     FOR INSERT
--     TO authenticated
--     WITH CHECK (auth.uid() = id);


-- ── C3. Verify, then test a real signup ─────────────────────────────────────
-- After C2 this must return ZERO rows — no INSERT policy on students.
SELECT polname,
       pg_get_expr(polwithcheck, polrelid) AS with_check_expr
FROM   pg_policy
WHERE  polrelid = 'public.students'::regclass
AND    polcmd = 'a';   -- 'a' = INSERT

-- Then register one throwaway account through the app and confirm its
-- public.students row appears.
--
-- ROLLBACK — restores the policy EXACTLY as C1c measured it. Note the
-- WITH CHECK is (auth.uid() = id), not (true): the original policy was never
-- permissive, and restoring it as (true) would create a hole that did not
-- exist before this migration.
--   CREATE POLICY "students: insert own profile"
--     ON public.students FOR INSERT TO authenticated
--     WITH CHECK (auth.uid() = id);


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION D — get_non_voter_emails()  (fixes the reminder filter failing open)
--                                                      [APPLIED 2026-09-03]
-- ════════════════════════════════════════════════════════════════════════════
--
-- Applied FIRST of the four sections — it was the only live-data correctness
-- bug in the set. Measured against live data on 2026-09-03, before the fix:
-- zero of the client-derived hashes matched ANY voter_registry row, so the
-- "closing" reminder's has_voted filter excludes nobody. It fails OPEN: every
-- student who has already voted is told they have not voted. No student has
-- voted yet, so the damage is still latent — it arms with the first ballot.
--
-- Cause: app/api/send-reminders/route.ts re-derived the hash in Node using
-- NEXT_PUBLIC_HASH_SALT, while the corrective migration derives it in-database
-- from a pepper in private.secrets. Two different peppers, no match, no
-- exclusion, and no error. This function moves the hashing server-side, where
-- the pepper actually lives, so the two can never diverge again.

-- ── D1. Find the in-database hash expression ────────────────────────────────
-- You must paste the SAME expression handle_new_user() uses into D2. Do not
-- guess it — a wrong expression reintroduces exactly this bug.
SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure);

-- Any helper that reads the pepper (likely what handle_new_user calls):
SELECT n.nspname AS schema,
       p.proname AS function,
       pg_get_function_identity_arguments(p.oid) AS args
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname IN ('public', 'private')
AND    pg_get_functiondef(p.oid) ILIKE '%secrets%'
ORDER  BY 1, 2;


-- ── D2. The function ────────────────────────────────────────────────────────
-- ⚠ TEMPLATE MARKER — private.hash_student_id(...) below is a PLACEHOLDER
--   name, not the expression that was executed. The applied version used the
--   project's actual hash helper, introduced by the earlier corrective
--   migration. Recover the applied text with:
--   SELECT pg_get_functiondef('public.get_non_voter_emails()'::regprocedure);
CREATE OR REPLACE FUNCTION public.get_non_voter_emails()
RETURNS TABLE (email text, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin-only. SECURITY DEFINER bypasses RLS, so this gate is the only thing
  -- standing between a caller and the full non-voter roll.
  IF coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  RETURN QUERY
  SELECT s.email::text, s.full_name::text
  FROM   public.students s
  WHERE  s.email IS NOT NULL
  AND    NOT EXISTS (
           SELECT 1
           FROM   public.voter_registry vr
           WHERE  vr.student_id_hash = private.hash_student_id(s.student_id)
           AND    vr.has_voted
         );
END;
$$;

REVOKE ALL     ON FUNCTION public.get_non_voter_emails() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_non_voter_emails() TO authenticated;

COMMENT ON FUNCTION public.get_non_voter_emails() IS
  'Admin-only. Returns students with no has_voted registry row, hashing '
  'student_id in-database so the pepper never leaves the server. Replaces a '
  'Node-side re-hash in /api/send-reminders that silently failed open.';


-- ── D3. Verify it excludes the right people ─────────────────────────────────
-- Run as an admin. non_voters must equal (total students - voted students).
-- If non_voters equals the total student count while voted > 0, the hash
-- expression in D2 is still wrong — do not send reminders until it matches.
SELECT (SELECT count(*) FROM public.students)                        AS total_students,
       (SELECT count(*) FROM public.voter_registry WHERE has_voted)  AS voted,
       (SELECT count(*) FROM public.get_non_voter_emails())          AS non_voters;
