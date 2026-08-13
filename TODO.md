# TODO — Assessment Platform

Living checklist for agents. Mark items `[x]` when done, add new open work under **Open**, and move finished work to **Done** with a short note.

Last updated: 2026-08-13

---

## Progress snapshot (2026-08-13)

Solid prototype: auth, CRUD, assignments (due/cohort/exam/named templates), media, bank import/export, grading, AI assist, time-spent tracking, light theme, keyboard nav, Docker, CI, ~115 questions. Remaining: **near-duplicate content review** and optional extra tutor HTML imports.

---

## Open

### Product / features
- [ ] (time-spent tracking shipped)

### Student UX / QoL
- [ ] (MC keys + autosize textarea + Ctrl/⌘+Enter shipped)

### Trainer UX / QoL
- [ ] (bank list/bulk/preview/import-export shipped)

### UI polish / accessibility
- [ ] (keyboard `/` `j`/`k`, focus traps, reduced-motion, sticky filters, light theme shipped)

### Engineering / polish
- [ ] (API tests expanded: templates, CSV, time spent, clone, grade, categories, users, import, media)

### Content
- [ ] Review remaining near-duplicates between template bank and tutor bank
- [ ] Optional: import more modules from other tutor HTML files if provided

---

## Done

### Time spent, light theme, CT/MRI tags, more API tests (2026-08-13)
- [x] Time-spent tracking (`TimeSpent` + `POST /api/time-spent`); live timer on answer page; trainer scoreboard/submissions/CSV
- [x] Light/dark theme toggle (header + login/register; `localStorage`)
- [x] CT-only preset + extra CT/MRI tagged questions (`ctQuestionsEn` + `mriQuestionsEn`)
- [x] API tests: time spent, clone, grade, categories, users, import, media

### Named templates + bank CSV + keyboard/a11y (2026-08-13)
- [x] Named assignment templates (`AssignmentTemplate` + `/api/assignment-templates`); save/apply/overwrite/delete on Assign tasks
- [x] Question bank CSV export (`GET /api/questions/export?format=csv`)
- [x] Keyboard QoL: `/` focus search, `j`/`k` list navigation, Enter activate
- [x] Focus traps on confirm/preview dialogs; `prefers-reduced-motion`
- [x] Mobile: sticky filters, denser cards, progress chip in header title
- [x] API tests for template CRUD + CSV export

### Media, bank import/export, exam mode, bank list (2026-08-05)
- [x] Media upload API (`/api/media`) + editor insert; MathText renders images/videos
- [x] Question bank JSON export/import + bulk delete
- [x] Compact list view + preview-as-student on `/trainer/questions`
- [x] Exam mode soft-locks MC after first submit (`QuestionAssignment.examMode`)
- [x] Student answer UX: MC 1–n keys, autosize textarea, Ctrl/⌘+Enter; loading skeletons
- [x] Docker Compose persists `data/dev.db` + `data/uploads`

### Assignment cohorts + due dates + trainer QoL (2026-08-05)
- [x] Assignment `dueAt` on QuestionAssignment; student dashboard due/overdue + % complete
- [x] Cohort apply (`studentIds[]`) + copy selection from student A → current
- [x] Submissions filters: category, type, free-text, missing AI review
- [x] Shared toast provider + confirm dialogs for delete user/category/question
- [x] Unsaved-changes warning on assignments + question editor

### Student progress + trainer grading + QoL (2026-08-05)
- [x] Student dashboard: progress overview (% / unanswered / MC / free-text), status filters, sort, resume CTA, empty states
- [x] Next / previous on answer page + local draft autosave for free-text
- [x] Header: display name + progress chip + student “My tasks” nav
- [x] Trainer free-text grade (score / pass-fail / comment) + release feedback (`PATCH /api/submissions/[id]/grade`)
- [x] Clone question (`POST /api/questions/[id]/clone`)
- [x] Fix overview bank count via `bank.totalQuestions`; scoreboard → `/trainer/submissions?student=`

### Content import — Medical Imaging Interview Q&A (2026-08-05)
- [x] Import from https://github.com/amine0110/Medical-Imaging-Interview-Questions-Answers (full answers via pycad.co) → `prisma/interviewQuestionsEn.ts` (36 free-text Qs)
- [x] Skipped near-duplicates: Q6 class imbalance, Q15/Q32 metrics overview, Q17 U-Net

### Engineering polish + PDF + progress email (2026-08-05)
- [x] Migrate `src/middleware.ts` → `src/proxy.ts` (Next 16 `proxy` convention)
- [x] Font Awesome webfonts: `scripts/copy-webfonts.mjs` → `public/webfonts` + absolute `@font-face` overrides
- [x] GitHub Actions CI: `prisma generate` + `db push` + build on PR/push
- [x] Rate-limit login (20/15m) and register (10/15m) by client IP
- [x] PDF export via browser print on `/trainer/submissions`
- [x] Student progress emails via SMTP (`POST /api/users/[id]/progress-email`)

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
