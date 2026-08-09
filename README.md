# GT-Vote — GCTU E-Voting System

<div align="center">

![GT-Vote Banner](public/gctu-crest.png)

**A secure, anonymous, and gamified electronic voting system for GCTU Student Representative Council Elections**

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?logo=supabase)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

[Features](#features) · [Architecture](#architecture) · [Getting Started](#getting-started) · [Security](#security) · [Screenshots](#screenshots)

</div>

---

## Overview

GT-Vote is a final year project developed by students of **Ghana Communication Technology University (GCTU)**. It is a secure, web-based election management system that resolves the **Voting Paradox** — the fundamental tension between verifying that only eligible students vote once, and guaranteeing that no one can trace a vote back to a specific student.

The system combines **cryptographic database separation** with **gamification techniques** to increase voter turnout, transparency, and trust in the election process.

---

## Features

### Student Features
- 🔐 **Secure Authentication** — Email OTP two-factor authentication on every login
- 🗳️ **Anonymous Voting** — Cryptographic separation ensures votes cannot be traced back to voters
- 📜 **Receipt Verification** — Every voter receives a unique receipt code to verify their ballot was counted
- 👥 **Candidate Profiles** — View full manifesto highlights and downloadable PDF manifestos
- 📊 **Live Dashboard** — Real-time turnout ring, faculty leaderboard, and countdown timer
- 📱 **Mobile First** — Fully responsive design optimised for mobile browsers

### Admin Features
- 📈 **Live Results** — Real-time vote tallying per position
- 🎛️ **Voting Control** — Open and close elections with a single toggle
- 📣 **Announcements** — Push announcements to all student dashboards
- 👤 **Candidate Management** — Add, edit, and remove candidates
- 🏫 **Voter Monitoring** — Monitor turnout statistics while preserving anonymity
- ⚙️ **Election Settings** — Configure election schedule, announcements, and options
- 📄 **PDF Export** — Export full election results as a formatted PDF report

### Security Features
- 🔒 **Voting Paradox Architecture** — Two-table database design with no foreign key link between voter identity and ballot choices
- 🧂 **Salted SHA-256 Hashing** — Student IDs stored as salted hashes, never in plain text
- 🛡️ **Row Level Security** — All database tables protected by PostgreSQL RLS policies
- 🚦 **Rate Limiting** — Brute force protection on all authentication endpoints
- 🧹 **Input Sanitization** — XSS and injection prevention on all user inputs
- 🔑 **app_metadata Roles** — Admin roles stored in tamper-proof `app_metadata`, not user-editable `user_metadata`

---

## Architecture

### The Voting Paradox Solution

GT-Vote resolves the Voting Paradox through a two-table PostgreSQL architecture:

```
voter_registry                    ballots
──────────────                    ───────
id (UUID)                         id (UUID)
student_id_hash  ←── NO LINK ──→  receipt_code
has_voted                         candidate_id → candidates
voted_at                          position
                                  created_at (randomised ±30s)
```

The `voter_registry` stores only a **salted SHA-256 hash** of the student ID alongside a boolean confirming they voted. The `ballots` table stores only anonymous vote choices and a cryptographic receipt code. There is **no foreign key, no shared timestamp, and no join possible** between these two tables — even the database administrator cannot link a ballot to a student.

### Database Schema

```
auth.users (Supabase Auth)
    │
    └── students (profile data)
            student_id, full_name, email, faculty, level

voter_registry (identity side — WHO voted)
    student_id_hash (salted SHA-256), has_voted, voted_at

ballots (anonymous side — WHAT was chosen)
    receipt_code, candidate_id → candidates, position

candidates
    full_name, faculty, position, slogan, manifesto_url

election_settings (singleton row)
    is_open, start_time, end_time, announcement
```

### Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16 + TypeScript | SSR, routing, type safety |
| Styling | Tailwind CSS | Mobile-first responsive design |
| Backend | Supabase | Auth, PostgreSQL, RLS, real-time |
| Database | PostgreSQL | ACID transactions, stored procedures |
| Deployment | Vercel | Edge hosting, serverless functions |
| PDF Generation | jsPDF | Client-side results PDF export |

---

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- A Supabase account — [supabase.com](https://supabase.com)
- A Vercel account (for deployment) — [vercel.com](https://vercel.com)

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/gt-vote.git
cd gt-vote
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the project root:

```bash
# Public — safe for browser
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Private — server only, never expose to browser
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
HASH_SALT=your-random-secret-salt-here
ADMIN_SECRET_KEY=your-admin-secret-key-here
```

> ⚠️ **Never commit `.env.local` to version control.** It is included in `.gitignore` by default.

### 4. Set up the Supabase database

In your Supabase project, go to **SQL Editor** and run the following in order:

**Enable extensions:**
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

**Create tables:**
```sql
-- Students profile
CREATE TABLE students (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  student_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  faculty TEXT NOT NULL,
  level TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voter registry (identity side)
CREATE TABLE voter_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id_hash TEXT UNIQUE NOT NULL,
  has_voted BOOLEAN DEFAULT FALSE NOT NULL,
  voted_at TIMESTAMPTZ
);

-- Candidates
CREATE TABLE candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  faculty TEXT NOT NULL,
  level TEXT,
  position TEXT NOT NULL,
  slogan TEXT,
  manifesto_url TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ballots (anonymous side)
CREATE TABLE ballots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_code TEXT NOT NULL,
  candidate_id UUID REFERENCES candidates(id) NOT NULL,
  position TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() -
    (INTERVAL '1 second' * floor(random() * 30)),
  CONSTRAINT ballots_receipt_position_unique UNIQUE (receipt_code, position)
);

-- Election settings (singleton)
CREATE TABLE election_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  is_open BOOLEAN DEFAULT FALSE NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  announcement TEXT,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO election_settings (id, is_open) VALUES (1, FALSE);
```

**Enable Row Level Security:**
```sql
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE voter_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_settings ENABLE ROW LEVEL SECURITY;
```

**Create the vote submission function:**
```sql
CREATE OR REPLACE FUNCTION submit_vote(
  p_student_id_hash TEXT,
  p_votes JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt TEXT;
  v_vote JSONB;
  v_already_voted BOOLEAN;
  v_attempts INT := 0;
BEGIN
  SELECT has_voted INTO v_already_voted
  FROM voter_registry
  WHERE student_id_hash = p_student_id_hash;

  IF v_already_voted IS TRUE THEN
    RAISE EXCEPTION 'ALREADY_VOTED';
  END IF;

  LOOP
    v_receipt := upper(
      substring(encode(gen_random_bytes(6), 'hex'), 1, 4) || '-' ||
      substring(encode(gen_random_bytes(6), 'hex'), 1, 4) || '-' ||
      substring(encode(gen_random_bytes(6), 'hex'), 1, 4)
    );
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM ballots WHERE receipt_code = v_receipt
    );
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique receipt code';
    END IF;
  END LOOP;

  INSERT INTO voter_registry (student_id_hash, has_voted, voted_at)
  VALUES (p_student_id_hash, TRUE, NOW())
  ON CONFLICT (student_id_hash) DO UPDATE
    SET has_voted = TRUE, voted_at = NOW();

  FOR v_vote IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    INSERT INTO ballots (receipt_code, candidate_id, position)
    VALUES (
      v_receipt,
      (v_vote->>'candidate_id')::UUID,
      v_vote->>'position'
    );
  END LOOP;

  RETURN v_receipt;
END;
$$;
```

### 5. Create the admin account

In **Supabase → Authentication → Users**, create a user with your admin email, then run:

```sql
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'),
  '{role}',
  '"admin"'
)
WHERE email = 'admin@gctu.edu.gh';
```

### 6. Configure Supabase Auth

In **Supabase → Authentication → Providers → Email**:
- Enable email provider
- Enable OTP for email confirmation
- Set OTP expiry to 300 seconds (5 minutes)
- Enable leaked password protection

### 7. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
gt-vote/
├── app/                          # Next.js App Router pages
│   ├── admin/                    # Admin panel
│   │   ├── page.tsx              # Admin login
│   │   ├── dashboard/page.tsx    # Admin dashboard
│   │   ├── candidates/page.tsx   # Candidate management
│   │   ├── voters/page.tsx       # Voter monitoring
│   │   └── settings/page.tsx     # Election settings
│   ├── api/                      # API routes
│   │   ├── auth/
│   │   │   ├── login/route.ts    # Login endpoint with rate limiting
│   │   │   └── register/route.ts # Register endpoint
│   │   └── admin/
│   │       └── verify/route.ts   # Admin secret key verification
│   ├── auth/callback/route.ts    # Supabase auth callback
│   ├── ballot/page.tsx           # Ballot casting page
│   ├── candidates/page.tsx       # Candidate browser
│   ├── dashboard/page.tsx        # Student dashboard
│   ├── home/page.tsx             # Landing page
│   ├── login/page.tsx            # Student login with OTP
│   ├── register/page.tsx         # Student registration
│   ├── reset-password/page.tsx   # Password reset
│   └── verify/page.tsx           # Receipt verification
├── components/                   # Shared components
│   ├── AdminNav.tsx              # Admin navigation
│   ├── PageBackground.tsx        # Animated background
│   └── TopNav.tsx                # Student navigation
├── lib/                          # Utilities and helpers
│   ├── auth.ts                   # hashStudentId (safe to import anywhere)
│   ├── auth-client.ts            # Client-side auth functions
│   ├── auth-server.ts            # Server-side auth functions
│   ├── data.ts                   # Positions and candidates data
│   ├── generateResultsPDF.ts     # PDF generation utility
│   ├── hooks.ts                  # Custom React hooks
│   ├── ratelimit.ts              # In-memory rate limiter
│   ├── sanitize.ts               # Input sanitization
│   ├── store.ts                  # (Legacy — being phased out)
│   ├── types.ts                  # TypeScript type definitions
│   └── supabase/
│       ├── client.ts             # Browser Supabase client
│       └── server.ts             # Server Supabase client
├── public/                       # Static assets
│   ├── manifestos/               # Candidate PDF manifestos
│   ├── gctu-crest.png            # University crest
│   └── campus-bg.jpg             # Background image
├── .env.local                    # Environment variables (gitignored)
├── .env.example                  # Example environment variables
├── .gitignore
├── middleware.ts                 # Route protection and auth middleware
├── next.config.js                # Next.js config with security headers
├── tailwind.config.ts            # Tailwind CSS configuration
└── tsconfig.json                 # TypeScript configuration
```

---

## Security

### Voting Paradox — Technical Details

The core security guarantee of GT-Vote is that **voter identity and ballot choice are permanently and cryptographically separated**:

1. When a student registers, their Student ID is hashed using `HMAC-SHA256` with a server-side salt stored in an environment variable
2. The resulting hash is stored in `voter_registry` — the Student ID itself is never stored
3. When a student votes, `submit_vote` marks the hash as voted and writes anonymous ballot rows with no reference to the student
4. Even if an attacker gains full database access, they cannot link a ballot to a student without also compromising the server environment to obtain the salt

### Security Layers

| Layer | Implementation |
|---|---|
| Authentication | Supabase Auth with email OTP 2FA |
| Password storage | Supabase bcrypt hashing |
| Student ID storage | Salted SHA-256 hash — never plaintext |
| Database access | Row Level Security on all 5 tables |
| Admin roles | PostgreSQL `app_metadata` — not user-editable |
| Rate limiting | 5 login attempts per IP per 5 minutes |
| Input validation | Character whitelisting + max length enforcement |
| XSS prevention | HTML character stripping on all inputs |
| HTTP headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| Cookie security | httpOnly, Secure, SameSite=Lax |
| Secret management | Server-only env vars, never NEXT_PUBLIC_ prefixed |

### Environment Variables

| Variable | Visibility | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Admin database access |
| `HASH_SALT` | Server only | Student ID hashing salt |
| `ADMIN_SECRET_KEY` | Server only | Admin panel third factor |

---

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Add all environment variables from `.env.local` in the Vercel dashboard
4. Deploy

### Update Supabase Auth URLs for production

In **Supabase → Authentication → URL Configuration**:
- **Site URL:** `https://your-domain.vercel.app`
- **Redirect URLs:** `https://your-domain.vercel.app/auth/callback`

---

## Development

### Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
```

### Adding a New Election Position

1. Insert candidates into Supabase via the admin panel or SQL
2. Update `lib/data.ts` with the new position and candidate UUIDs from Supabase
3. Update `lib/types.ts` if the data structure changes

### Running a Mock Election

1. Register at least two test student accounts
2. Log in to the admin panel and open voting
3. Log in as each student and cast ballots
4. Verify receipts on the verify page
5. Check the admin dashboard for live results

---

## Gamification

GT-Vote uses three evidence-based gamification techniques to increase voter participation:

| Feature | Mechanism | Research Basis |
|---|---|---|
| Faculty Leaderboard | Social proof — students see their faculty's participation rate vs others | Bossetta (2022) — game mechanics in political platforms |
| Turnout Progress Ring | Real-time visual feedback on overall participation | FH Joanneum (2021) — gamified election design |
| Countdown Timer | Urgency and scarcity — creates deadline pressure | Salud (2025) — interactive platforms for Gen Z civic engagement |

> **Note:** Live turnout percentages show participation rates per faculty — not candidate vote counts. This motivates participation without creating herding bias toward winning candidates.

---

## Team

Developed as a Final Year Project at **Ghana Communication Technology University**

| Name | Role |
|---|---|
| Edwin Safo | Lead Developer |
| Kofi Klah | Frontend Developer |
| Lord | Backend & Security |

**Supervisor:** [Supervisor Name]  
**Academic Year:** 2025 / 2026

---

## Literature References

1. Bossetta, M. (2022). *Gamification in Political Communication and Civic Engagement*
2. IEEE (2025). *Security Standards for Electronic Voting Systems*
3. Javed, A. (2021). *Cryptographic Approaches to E-Voting Privacy*
4. Sharp, R. et al. (2023). *Blockchain-Based Voting Systems: A Review*
5. Rostan & Ahmad Safawee (2025). *Online Voting for College Communities*
6. Campbell, C. et al. (2011). *Voting on a Smartphone*
7. Salud, J. (2025). *Digital Civic Platforms for Generation Z*
8. Bishop, M. & Wagner, D. (2007). *Risks of E-Voting*
9. FH Joanneum (2021). *Gamified Election Interface Design*

---

## License

This project is developed for academic purposes at Ghana Communication Technology University.  
© 2025 GT-Vote Team — GCTU Faculty of Computing and Information Systems

---

<div align="center">
  <strong>GT-Vote</strong> — Secure. Anonymous. Your voice matters.
  <br/>
  <sub>Built with ❤️ by GCTU IT Students</sub>
</div>
