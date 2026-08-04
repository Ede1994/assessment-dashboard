# MEMORY — Assessment Platform

Shared memory for agents across chats/sessions. Write like a human notebook: durable facts, decisions, pitfalls, and “where things live.” Newest entries at the top of **Session log**.

Last updated: 2026-08-04

---

## Project identity

- **Repo:** `assessment-dashboard` (local path often `~/Documents/GitHub/assessment-dashboard`).
- **Goal:** Prototype platform for student assessment tasks in medical data engineering / DL / CT-MRI — not a production LMS.
- **UI language:** English (students normally speak English). Source HTML templates were German.
- **Design source:** Dark Tailwind “medical” look from  
  `~/Downloads/medical_data_engineering_prep_dashboard-2.html`  
  (interview-prep cards → generic “Student Assessment Platform”; strip FUSE-AI personal framing).

---

## Hard decisions (do not quietly reverse)

| Decision | Choice | Why |
|----------|--------|-----|
| Stack | Next.js App Router + Prisma + SQLite | Fast single-app prototype |
| Auth | bcrypt password hashes + iron-session cookies | Real credential storage; signed sessions |
| Self-register | Students only (`/register`) | Trainers provisioned by trainers |
| Answer types | Mix free-text + multiple choice | User choice |
| Solutions visibility | Never on student APIs | Trainer-only via `/api/solutions` and trainer pages |
| Task scoping | Per-student `QuestionAssignment` | e.g. CT track without MRI tasks |
| Empty assignments | If a student has **0** assignments → show **full** bank | Avoid locking demos; curated sets use explicit assignments |
| Question authoring | Trainer in-UI CRUD + seed bootstrap | Day-to-day edits without reseed |

---

## Credentials & demos

| User | Pass | Role | Seed behavior |
|------|------|------|----------------|
| `student` | `student` | STUDENT | All questions assigned (~66) — “full track” |
| `student2` | `student2` | STUDENT | CT-focused: MRI-heavy titles/tags filtered out (~61) |
| `trainer` | `NRAD2026` | TRAINER | Full bank, assignments UI, submissions |


- Env: `DATABASE_URL=file:./prisma/dev.db`, `SESSION_SECRET=…` (see `.env.example`). SQLite file lives under `prisma/dev.db` (not repo root).
- Cross-platform: one `better-sqlite3@13` via package `overrides` (no nested v12); Linux prebuilds included. Fallback compilers: `build-essential` + `python3`.

---

## Architecture map

```
/login
/student                    → assigned questions only (if any assignments)
/student/questions/[id]     → answer form; 403 if not assigned
/trainer                    → overview
/trainer/questions          → bank + ideal solutions
/trainer/assignments        → pick questions per student
/trainer/submissions        → student answer vs ideal solution

API: /api/auth/*, /api/questions, /api/submissions, /api/solutions (trainer), /api/assignments (trainer)
```

- Prisma client generated to `src/generated/prisma` (gitignored); `postinstall` / `prisma generate`.
- Prisma 7 needs `@prisma/adapter-better-sqlite3` + path helper in `src/lib/prisma.ts`.
- Seed: `prisma/seed.ts` + `prisma/tutorQuestionsEn.ts`; run `npm run db:seed` or `db:reset`.

---

## Content provenance

1. **Prep dashboard HTML** → original ~16 rounds (PyTorch OOM, DICOM resampling, GroupKFold, U-Net skip mismatch, STAPLE, etc.) translated/adapted + extra CT/MRI items.
2. **Tutor HTML** `~/Downloads/deep_learning_medizin_tutor.html` → 41 quiz FAQ items; **39** imported in English; **skipped duplicates:** Q1.6 (log_softmax / numerical stability), Q2.4 (anisotropic 3D CNN — overlaps existing anisotropic U-Net topic).
3. Categories include: `pytorch`, `python`, `medical-data`, `ai-dl`, `dl-basics`, `ct-mri`, `dicom`, `governance`, `architecture`.

MRI-heavy filter used for `student2` seed (regex-ish on title/tags/prompt): MRI, MRT, FLAIR, Nyúl, bias field, 2.5D, etc. — see `isMriHeavy()` in `prisma/seed.ts`.

---

## Operational notes / pitfalls

- After schema changes: `npx prisma db push` then `npm run db:seed` (seed wipes submissions/assignments/questions).
- Dev server: `npm run dev` → http://localhost:3000. Next 16 warns that `middleware` is deprecated in favor of `proxy`.
- Do **not** edit the Cursor plan file under `~/.cursor/plans/` unless the user asks; product truth is the repo + this MEMORY/TODO.
- Autoreview may block destructive DB resets (`rm` db / force seed); request approval when needed.
- Font Awesome via `@fortawesome/fontawesome-free` CSS import in `globals.css`; KaTeX via `MathText` client component.

---

## Session log

### 2026-08-04 — Docker image + API tests
- Multi-stage `Dockerfile` (Debian Bookworm slim): Node 22, npm, sqlite3 CLI, build-essential/python3; `docker-compose.yml`; README Docker section.
- `npm test` → `scripts/run-tests.sh` seeds `prisma/test.db`, starts `next start` on :3010 with `SESSION_COOKIE_SECURE=false`, runs `tests/api.test.ts` (auth / assignment filter / MC submit).
- Ubuntu native install confirmed working by user.

### 2026-08-04 — Trainer password + CT quiz import
- Default seeded trainer password is now `NRAD2026` (login demo button + README updated).
- Imported 8 CT questions/solutions from `CT_Fragen.docx` / `Lösung CT_Fragen.docx` into `prisma/ctQuestionsEn.ts` (ct-mri category); FBP figure at `public/seed-assets/ct/fbp-reconstructions.png`.
- Multi-correct items stored as FREE_TEXT (student MC UI is single-select). `MathText` now renders `![alt](url)` and preserves newlines.
- README: “Updating the local database after a pull” (`db:seed` / `db:reset`).

### 2026-08-04 — Linux / Debian-Ubuntu install compatibility
- `npm install` failures on Linux were caused by a **nested** `better-sqlite3@12` (from `@prisma/adapter-better-sqlite3`) that runs `prebuild-install || node-gyp rebuild` and needs `build-essential` + Python when prebuilds miss.
- Fix: npm `overrides` force a single `better-sqlite3@13` (ships `linux-x64` / `linux-arm64` prebuilds, no install compile script). Added `.npmrc`, `.nvmrc` (22), `engines`, `npm run check:native` / `npm run setup`, README Linux section, optional `Dockerfile`.
- On Debian/Ubuntu: prefer Node 22 via nvm; only install `build-essential python3` if native load still fails.

### 2026-08-04 — Real auth + question bank editor
- User asked for in-UI question CRUD and real authentication (no plaintext passwords).
- Auth: `passwordHash` + bcryptjs; `/register` (students); `/account` change password; trainer `/trainer/users` provisioning; iron-session kept for cookies; production requires `SESSION_SECRET` ≥32 chars.
- Question editor: POST/PUT/DELETE on `/api/questions`; UI at `/trainer/questions/new` and `/trainer/questions/[id]/edit`; delete from bank list.
- Demo seed passwords still `student`/`trainer` but stored hashed; new accounts need ≥8 chars.

### 2026-08-04 — Continuity docs
- User asked for `TODO.md` (shared open/done board) and `MEMORY.md` (cross-agent memory). Created both at repo root.

### 2026-08-04 — Tutor import + assignments
- User provided second HTML: `deep_learning_medizin_tutor.html`. Extracted quiz Q&A, English seed module, skipped 2 duplicates.
- Added `QuestionAssignment`, trainer **Assign tasks** page, student filtering by assignment.
- Demo: `student` full set; `student2` CT-focused without MRI-heavy items.
- Bank size after seed: **66** questions; build verified.

### 2026-08-04 — Initial prototype
- Empty repo → scaffolded Next.js + Prisma/SQLite assessment platform from first HTML template.
- User chose: stack Next.js (1A), answer mix free-text+MC (2C), UI/questions in English.
- Implemented mock student/trainer logins, APIs, dark dashboard UI, README.

---

## Instructions for agents writing memory

After meaningful work in a session, append a short **Session log** entry:

1. Date + one-line title  
2. What the user wanted  
3. What changed (files/features)  
4. Decisions or pitfalls future agents must know  

Update tables above if credentials, routes, or hard decisions change. Prefer amending facts over duplicating novels.
