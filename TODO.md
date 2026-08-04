# TODO — Assessment Platform

Living checklist for agents. Mark items `[x]` when done, add new open work under **Open**, and move finished work to **Done** with a short note.

Last updated: 2026-08-04

---

## Open

### Product / features
- [ ] Student progress emails (CSV export done)
- [ ] Optional: PDF export of submissions

### Engineering / polish
- [ ] Migrate Next.js `middleware` → `proxy` (Next 16 deprecation warning)
- [ ] Ensure Font Awesome webfonts resolve reliably in production (CSS import path)
- [ ] CI: `prisma generate` + `db push`/`migrate` + build on PR
- [ ] Rate-limit login/register endpoints

### Content
- [ ] Review remaining near-duplicates between template bank and tutor bank
- [ ] Add more CT-only / MRI-only tagged questions for cleaner assignment filters
- [ ] Optional: import more modules from other tutor HTML files if provided

---

## Done

### Assignment presets + student admin + CSV + categories (2026-08-04)
- [x] Named assignment presets on `/trainer/assignments`: CT-track, MRI-track, PyTorch-only (`src/lib/assignmentPresets.ts`)
- [x] Trainer user delete + password reset (`DELETE`/`PATCH` `/api/users/[id]`)
- [x] CSV export of filtered submissions on `/trainer/submissions`
- [x] In-UI category editor (`/trainer/categories` + POST/PUT/DELETE `/api/categories`)

### MC scoreboard + AI free-text assist (2026-08-04)
- [x] Auto-grade MC on submit; student Correct/Incorrect; trainer MC scoreboard on overview
- [x] Trainer AI assist via Open WebUI OpenAI-compatible API (`AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL`)

### Docker + API tests (2026-08-04)
- [x] Multi-stage Debian Bookworm Docker image (`node` 22, `npm`, `sqlite3`, build tools) + `docker compose`
- [x] Minimal API tests via `npm test`: auth, assignment filter (`student2`), MC submit
- [x] User confirmed native Ubuntu install workflow works

### CT quiz + trainer password (2026-08-04)
- [x] Seeded trainer password `NRAD2026`
- [x] Import CT_Fragen / Lösung CT_Fragen into `ctQuestionsEn.ts` + FBP figure asset
- [x] README: refresh local DB after pull

### Linux install hardening (2026-08-04)
- [x] Force single `better-sqlite3@13` via npm overrides (drop nested v12 node-gyp path)
- [x] `.npmrc`, `.nvmrc`, `engines`, `check:native` / `setup` scripts, README Debian/Ubuntu section, optional Dockerfile
- [x] Linux install path verified on a real Debian/Ubuntu host

### Auth + question editor (2026-08-04)
- [x] Real auth: bcrypt `passwordHash`, student self-register, change password, trainer user provisioning
- [x] Signed httpOnly iron-session cookies; `SESSION_SECRET` required in production (≥32 chars)
- [x] In-UI question bank editor: create / edit / delete questions + solutions (+ MC choices)
- [x] Trainer routes: `/trainer/questions/new`, `/trainer/questions/[id]/edit`, `/trainer/users`, `/account`, `/register`

### Prototype platform (sessions 2026-08-04)
- [x] Next.js App Router + TypeScript + Tailwind dark medical UI (from interview-prep HTML look)
- [x] Prisma + SQLite (`better-sqlite3` adapter, Prisma 7)
- [x] Demo accounts: `student`/`student`, `student2`/`student2`, `trainer`/`NRAD2026` (passwords hashed in DB)
- [x] Student routes: list, filter/search, answer free-text & MC (no solutions leaked)
- [x] Trainer routes: overview, question bank + solutions, submissions side-by-side
- [x] Seed English question bank from medical data engineering prep HTML (~16 scenarios + CT/MRI extras)
- [x] Import Q&A from `deep_learning_medizin_tutor.html` → English in `prisma/tutorQuestionsEn.ts` (skip Q1.6, Q2.4 duplicates)
- [x] `QuestionAssignment` model + `/api/assignments` + `/trainer/assignments` UI
- [x] Students only see assigned questions; demo: full track vs CT-focused (`student2`)
- [x] README with setup and credentials
- [x] `TODO.md` + `MEMORY.md` for cross-agent continuity
- [x] Pushed to https://github.com/Ede1994/assessment-dashboard

---

## How agents should update this file

1. When starting work: claim an open item (add `In progress — <agent/session>` under it).
2. When finishing: move to **Done** with date + one-line note; clear in-progress.
3. When discovering new work: add under **Open**; do not delete history from **Done**.
4. Keep bullets short; details belong in `MEMORY.md` or the PR description.
