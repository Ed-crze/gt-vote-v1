-- ════════════════════════════════════════════════════════════════════════════
-- GT-Vote — candidate data cleanup
--
-- STATUS         NOT APPLIED — run this yourself in the Supabase SQL editor.
-- DATE WRITTEN   2026-09-17
-- SCOPE          public.candidates only. Touches no vote data: voter_registry,
--                ballots, submit_vote() and every RLS policy are left alone.
--
-- WHAT IT DOES
--   1. Title-cases candidate names that were entered in lower case.
--   2. Moves the "L400"-style level suffix out of faculty into candidates.level,
--      then normalises faculty to exactly the three GCTU faculty names the rest
--      of the app already uses.
--   3. Clears every candidate photo so the initials avatar fallback renders.
--
-- ⚠ TWO COLUMN NAMES DIFFER FROM THE BRIEF — this file uses the real ones:
--     • the name column is  full_name,  not  name
--     • the photo column is avatar_url, not  photo_url
--       (there is no photo_url column anywhere in this project)
--   Confirmed against app/admin/candidates/page.tsx, app/ballot/page.tsx,
--   app/candidates/page.tsx, app/results/page.tsx and seed-votes.js, which all
--   select: id, full_name, position, faculty, level, slogan, avatar_url,
--   manifesto_url. STEP 0a re-confirms this against the live database.
--
-- HOW TO RUN
--   Run STEP 0 first and read the output — it tells you what you are about to
--   change. Then run steps 1 → 5 IN ORDER (step 2 must precede step 3: step 3
--   destroys the "- L400" suffix that step 2 reads). Finish with STEP 6.
--   To make steps 1–5 all-or-nothing, wrap them in BEGIN; ... COMMIT;.
--
-- ORDER MATTERS
--   0 audit → 1 names → 2 level → 3 faculty → 4 flag leftovers → 5 photos → 6 verify
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 0 — AUDIT (read-only; nothing here changes data)
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0a. Confirm the column names before trusting anything below ─────────────
SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_schema = 'public' AND table_name = 'candidates'
ORDER  BY ordinal_position;
-- EXPECT to see full_name, faculty, level and avatar_url in this list.
-- If you see a column literally named photo_url or name, STOP and re-read this
-- file — every statement below would be targeting the wrong column.

-- ── 0b. Anything that would block the faculty rewrite? ──────────────────────
-- A CHECK constraint or a foreign key to a faculties lookup table would reject
-- the three target names unless they already exist there. Expect no rows, or
-- only constraints you recognise.
SELECT conname,
       contype,          -- 'c' = CHECK, 'f' = FOREIGN KEY
       pg_get_constraintdef(oid) AS definition
FROM   pg_constraint
WHERE  conrelid = 'public.candidates'::regclass
ORDER  BY contype, conname;

-- ── 0c. Every distinct faculty value, with row counts ──────────────────────
-- This is the list the mappings in step 3 have to cover. Anything here that
-- step 3 does not name will be reported by step 4.
SELECT faculty,
       count(*) AS candidates,
       -- what step 3 will match on: suffix stripped, lower-cased, trimmed
       lower(btrim(regexp_replace(coalesce(faculty, ''), '\s*-\s*[Ll]?\d+\s*$', ''))) AS match_key
FROM   public.candidates
GROUP  BY faculty
ORDER  BY faculty;

-- ── 0d. Names that step 1 will rewrite ─────────────────────────────────────
SELECT id, full_name, initcap(full_name) AS becomes, position
FROM   public.candidates
WHERE  full_name = lower(full_name)
ORDER  BY full_name;

-- ── 0e. How many photos step 5 will clear ──────────────────────────────────
SELECT count(*) AS candidates_with_photo
FROM   public.candidates
WHERE  avatar_url IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 1 — TITLE-CASE THE NAMES
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1a. Collapse stray whitespace first ────────────────────────────────────
-- Leading/trailing spaces and double spaces inside a name break initcap's word
-- boundaries and also break getInitials() in the app, which splits on spaces.
UPDATE public.candidates
SET    full_name = btrim(regexp_replace(full_name, '\s+', ' ', 'g'))
WHERE  full_name IS DISTINCT FROM btrim(regexp_replace(full_name, '\s+', ' ', 'g'));

-- ── 1b. Title-case only the all-lower-case rows ────────────────────────────
-- Deliberately scoped to full_name = lower(full_name) rather than to every row
-- where initcap() would change something. Running initcap over the whole table
-- would quietly damage correctly-cased names: 'McDonald' becomes 'Mcdonald',
-- 'deGraft' becomes 'Degraft'. Rows already carrying a capital are left alone.
-- Catches: 'john winston', 'derrick bar', 'kofi kingston', 'jaon black'.
UPDATE public.candidates
SET    full_name = initcap(full_name)
WHERE  full_name = lower(full_name)
AND    full_name <> '';

-- ── 1c. OPTIONAL — SHOUTED names ───────────────────────────────────────────
-- Only run this if step 0d / step 6a shows rows like 'JOHN WINSTON'. It is
-- separated out because a name that is legitimately an acronym would be
-- flattened by it.
-- UPDATE public.candidates
-- SET    full_name = initcap(full_name)
-- WHERE  full_name = upper(full_name)
-- AND    full_name ~ '[A-Z]';


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 2 — MOVE THE LEVEL SUFFIX INTO candidates.level
--          RUN THIS BEFORE STEP 3 — step 3 strips the suffix this reads.
-- ════════════════════════════════════════════════════════════════════════════
--
-- The level column already exists, so the suffix is moved, not dropped.
-- FORMAT: the bare number, '400' — NOT 'L400' and NOT 'Level 400'. The app
-- renders the literal "Level " itself (app/candidates/page.tsx:294 and
-- app/ballot/page.tsx:498 both print `Level {level}`), and the admin form
-- placeholder is "e.g. 400". Storing 'L400' would display as "Level L400".
--
-- NOTE: public.students stores levels as 'Level 400' instead. The two tables
-- have always disagreed; this file matches the candidates convention and does
-- not touch students.

-- ── 2a. Preview what moves where ───────────────────────────────────────────
SELECT id, full_name, faculty,
       level                                        AS level_now,
       substring(faculty from '[Ll]?(\d+)\s*$')     AS level_becomes
FROM   public.candidates
WHERE  faculty ~ '\s*-\s*[Ll]?\d+\s*$'
ORDER  BY faculty;

-- ── 2b. Rows where level is ALREADY set and disagrees with the suffix ──────
-- Expect zero rows. Any row here is a real conflict — decide it by hand,
-- because 2c will not overwrite an existing level.
SELECT id, full_name, faculty, level AS existing_level,
       substring(faculty from '[Ll]?(\d+)\s*$') AS suffix_level
FROM   public.candidates
WHERE  faculty ~ '\s*-\s*[Ll]?\d+\s*$'
AND    coalesce(btrim(level), '') <> ''
AND    btrim(level) IS DISTINCT FROM substring(faculty from '[Ll]?(\d+)\s*$');

-- ── 2c. Fill level from the suffix, without clobbering an existing value ───
UPDATE public.candidates
SET    level = substring(faculty from '[Ll]?(\d+)\s*$')
WHERE  faculty ~ '\s*-\s*[Ll]?\d+\s*$'
AND    coalesce(btrim(level), '') = '';


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 3 — NORMALISE faculty TO THE THREE OFFICIAL NAMES
-- ════════════════════════════════════════════════════════════════════════════
--
-- Targets (these are the exact strings app/register/page.tsx:43-47 and
-- seed-students.js:28-32 already use — do not vary the spelling):
--     Faculty of Computing and Information Systems
--     Faculty of IT Business
--     Faculty of Engineering
--
-- Every statement matches on the same key: faculty with the level suffix
-- stripped, lower-cased and trimmed. Each is written so re-running it is a
-- no-op, and so a row already holding the correct value is not rewritten.
-- Anything not named below is left EXACTLY as it is and reported by step 4 —
-- nothing is silently bucketed.

-- ── 3a. Engineering ────────────────────────────────────────────────────────
-- Covers: 'Engineering - L400', 'Engineering - L300'
UPDATE public.candidates
SET    faculty = 'Faculty of Engineering'
WHERE  lower(btrim(regexp_replace(coalesce(faculty, ''), '\s*-\s*[Ll]?\d+\s*$', '')))
         IN ('engineering', 'eng', 'faculty of engineering', 'foe')
AND    faculty IS DISTINCT FROM 'Faculty of Engineering';

-- ── 3b. IT Business ────────────────────────────────────────────────────────
-- Covers: 'Business - L400', 'Business - L300'
-- 'business' maps here because IT Business is the only business faculty of the
-- three targets.
UPDATE public.candidates
SET    faculty = 'Faculty of IT Business'
WHERE  lower(btrim(regexp_replace(coalesce(faculty, ''), '\s*-\s*[Ll]?\d+\s*$', '')))
         IN ('business', 'it business', 'faculty of it business', 'foitb',
             'business administration')
AND    faculty IS DISTINCT FROM 'Faculty of IT Business';

-- ── 3c. Computing and Information Systems ──────────────────────────────────
-- Covers: 'Computing - L400', 'Computing - L300'
UPDATE public.candidates
SET    faculty = 'Faculty of Computing and Information Systems'
WHERE  lower(btrim(regexp_replace(coalesce(faculty, ''), '\s*-\s*[Ll]?\d+\s*$', '')))
         IN ('computing', 'computing and information systems', 'information systems',
             'faculty of computing and information systems', 'cis', 'focis')
AND    faculty IS DISTINCT FROM 'Faculty of Computing and Information Systems';

-- ── 3d. ⚠ JUDGEMENT CALL — bare "IT" ───────────────────────────────────────
-- Covers: 'it', 'IT', 'Faculty of IT', 'IT - L400', 'IT - L300'
--
-- READ THIS BEFORE RUNNING 3d. Two of the three target faculties contain the
-- letters "IT" — Computing and Information Systems, and IT Business — so a
-- bare "IT" is genuinely ambiguous in a way that "Computing" and "Business"
-- are not. It is mapped to Computing and Information Systems on the reasoning
-- that "IT Business" is never abbreviated to plain "IT" in this project (the
-- rows that mean that faculty all say "Business"), so "IT" is the computing
-- faculty by elimination.
--
-- That is an assumption about YOUR data, not a fact this file can verify.
-- Check it against step 0c: look at how many rows say "IT" versus "Business",
-- and at which positions those candidates are standing for. If any of them
-- belong to IT Business, fix those rows by id first, then run this.
--
-- To send them to IT Business instead, swap the SET value and the
-- IS DISTINCT FROM value for 'Faculty of IT Business'.
UPDATE public.candidates
SET    faculty = 'Faculty of Computing and Information Systems'
WHERE  lower(btrim(regexp_replace(coalesce(faculty, ''), '\s*-\s*[Ll]?\d+\s*$', '')))
         IN ('it', 'i.t.', 'i.t', 'faculty of it', 'information technology')
AND    faculty IS DISTINCT FROM 'Faculty of Computing and Information Systems';


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 4 — FLAG WHAT COULD NOT BE MAPPED  (read-only — fix these by hand)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Deliberately NOT an UPDATE. 'Applied Sci. - L300' / 'Applied Sci. - L400' is
-- the known case: GCTU has no applied-sciences faculty among the three targets,
-- so guessing would put a real candidate in the wrong faculty on a published
-- results page. These rows keep their original string until you decide.
--
-- Note their faculty still carries the '- L300' suffix, because step 3 only
-- rewrites rows it recognised. Their level was still captured by step 2c.
SELECT id,
       full_name,
       position,
       faculty AS unmapped_faculty,
       level
FROM   public.candidates
WHERE  faculty IS NULL
   OR  btrim(faculty) = ''
   OR  faculty NOT IN ('Faculty of Computing and Information Systems',
                       'Faculty of IT Business',
                       'Faculty of Engineering')
ORDER  BY faculty, full_name;

-- Once you have decided where a flagged candidate belongs, set it by id:
--   UPDATE public.candidates
--   SET    faculty = 'Faculty of Engineering',   -- the faculty you decided on
--          level   = '300'                       -- only if step 2c left it empty
--   WHERE  id = '<paste the id from the query above>';


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 5 — CLEAR ALL CANDIDATE PHOTOS
-- ════════════════════════════════════════════════════════════════════════════
--
-- Intended behaviour: every surface that shows a candidate photo already falls
-- back to an initials avatar when avatar_url is null —
--   app/results/page.tsx:255-259,  app/candidates/page.tsx:219,
--   app/ballot/page.tsx:423, :489, :555
-- all render getInitials(name) in the null branch, so this degrades cleanly
-- rather than leaving broken images.
--
-- This only clears the database reference. Any files already uploaded stay in
-- the storage bucket, orphaned but harmless; delete them from Storage in the
-- Supabase dashboard if you want them gone. The admin candidate form can set a
-- new photo at any time — this is a reset, not a lock.
UPDATE public.candidates
SET    avatar_url = NULL
WHERE  avatar_url IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 6 — VERIFY
-- ════════════════════════════════════════════════════════════════════════════

-- ── 6a. No lower-case-only names left ──────────────────────────────────────
-- Expect zero rows.
SELECT id, full_name
FROM   public.candidates
WHERE  full_name = lower(full_name)
   OR  full_name = upper(full_name)
   OR  full_name <> btrim(regexp_replace(full_name, '\s+', ' ', 'g'));

-- ── 6b. Faculty values are now exactly the three official names ────────────
-- Expect at most three rows, each one an exact target name. Any other row here
-- is a step 4 leftover still waiting on your decision.
SELECT faculty, count(*) AS candidates
FROM   public.candidates
GROUP  BY faculty
ORDER  BY faculty;

-- ── 6c. No level suffix survives in faculty ────────────────────────────────
-- Expect zero rows once step 4's leftovers have been resolved.
SELECT id, full_name, faculty, level
FROM   public.candidates
WHERE  faculty ~ '[Ll]?\d+\s*$';

-- ── 6d. Every photo cleared ────────────────────────────────────────────────
-- Expect 0.
SELECT count(*) AS candidates_still_with_photo
FROM   public.candidates
WHERE  avatar_url IS NOT NULL;

-- ── 6e. Eyeball the finished table ─────────────────────────────────────────
SELECT full_name, position, faculty, level, avatar_url
FROM   public.candidates
ORDER  BY position, full_name;


-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════════════════
-- There is none — these are in-place UPDATEs over live rows. If you want a way
-- back, take a snapshot BEFORE running step 1:
--
--   CREATE TABLE public.candidates_backup_20260917 AS
--   SELECT * FROM public.candidates;
--
-- and restore a column from it afterwards, e.g.:
--
--   UPDATE public.candidates c
--   SET    full_name  = b.full_name,
--          faculty    = b.faculty,
--          level      = b.level,
--          avatar_url = b.avatar_url
--   FROM   public.candidates_backup_20260917 b
--   WHERE  c.id = b.id;
--
-- Drop the backup table once the screenshots are captured.
