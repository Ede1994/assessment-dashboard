# TODO — Assessment Platform

Living checklist for agents. Mark items `[x]` when done, add new open work under **Open**, and move finished work to **Done** with a short note.

Last updated: 2026-10-12 (production hardening pass completed; live on CT 104)

---

## Progress snapshot (2026-10-12)

Solid prototype: auth, CRUD, assignments, media, bank import/export, grading, AI assist, time-spent tracking, light theme, keyboard nav, Docker, CI, coding exercises (Python / JavaScript / MATLAB fill-in-the-blank IDE), ~143 questions including clinical Foundation Models and Agentic Systems topics.

**Deployed & hardened (2026-10-12):** live at https://assessment.entropy-manager.de (Cloudflare Tunnel) and LAN http://192.168.178.36:3000. Secrets moved to `.env`, credentials rotated, WAL mode, backups (cron + vzdump), log rotation, webfonts fixed, README runbook added. Remaining: media authorization, client-IP-aware rate limiting, Cloudflare Access (optional), SMTP (optional).

---

## Open

### Production hardening — remaining items
- [ ] Media privacy: `/public/uploads/*` is served without app-level authorization (files are unguessable names, but URLs shared in questions leak by design). If assessments must stay private, move media outside `public` and serve via an authenticated route.
- [ ] Rate limiting counts the tunnel/edge IP, not the real client — wire real client IP (trusted `X-Forwarded-For` from cloudflared) into the rate limiter, or enable Cloudflare Access in front of the app for restricted teams.
- [ ] Optional: Cloudflare Access policy for restricted classes/teams before sharing the URL widely.
- [ ] Optional: SMTP values for student progress emails still unset — configure when needed.
- [ ] Reserve 192.168.178.36 in the DHCP server (FritzBox); the Cloudflare ingress and trainer LAN access depend on this address.

### Content
- [ ] Review remaining near-duplicates between template bank and tutor bank

---

## Deployment notes (CT 104 — Hermes, 2026-10-12)

Facts and gotchas from the actual install; verified, not user-reported:

- **Runtime:** unprivileged LXC CT 104 `assessment`, Ubuntu 24.04 LTS, 2 vCores / 4 GB RAM + 512 MB swap / 20 GB disk, nesting+keyctl, Docker 29.1.3, Compose v2 2.40.3, IP 192.168.178.36 (DHCP). Docker-in-LXC verified working.
- **Install path:** repo at `/opt/assessment-dashboard`; `docker compose up -d --build` succeeds (~5 min).
- **Gotcha — bind-mount DB initialization (predicted in the earlier revision, confirmed):** first `up` crashed: `./data/dev.db` did not exist, Docker created a *directory* at that path, mount failed (`not a directory`). Fix: extract the seeded DB from the built image before first start (`docker create` → `docker cp <c>:/app/prisma/dev.db ./data/dev.db` → `docker rm` → `up -d`). A plain `touch data/dev.db` yields an empty DB without tables.
- **Gotcha — SQLite readonly (found live):** the app runs as UID 1001 (`nextjs`) inside the container; root-owned `data/dev.db` made every write fail with `attempt to write a readonly database` (surfaced in the UI as "Network error" on trainer actions). Fix: `chown -R 1001:1001 data/`. **Always chown mounted data after extracting/copying files as root.**
- **Compose layout (updated):** tracked `docker-compose.yml` is now generic (`${SESSION_SECRET:-...}`, `${AI_*:-}` with safe defaults, no server secrets); server-specific settings (SESSION_COOKIE_SECURE=true, backups volume) live in untracked `docker-compose.override.yml`; secrets in untracked `.env` (chmod 600). `.gitignore` covers `docker-compose.override.yml`; `.dockerignore` excludes `.env*` (keeps `.env.example`) and `data/`.
- **SESSION_COOKIE_SECURE=true** set via override (public HTTPS via Cloudflare; iron-session defaults secure=true in production anyway — now explicit).
- **Webfonts fixed in Dockerfile:** builder stage now runs `npm run copy:webfonts` (the deps stage `npm ci --ignore-scripts` skips the postinstall copy) — verified `fa-solid-900.woff2` etc. present in the runtime image.
- **AI assist (Open WebUI):** `AI_BASE_URL=https://ki-plattform.diz-ag.med.ovgu.de`, `AI_MODEL=gemma4:31b-it`, key via `.env`.
- **Tunnel topology (deviation from containerized-connector recommendation, intentional):** `cloudflared` runs as a systemd service on the CT host (installed by Eric), ingress `assessment.entropy-manager.de` → `http://192.168.178.36:3000`. App port stays published on the LAN for trainer use.
- **Not done (by design):** containerized tunnel connector on the compose network (host-level service chosen), public key pinning of connector image.

---

## Done

### Production hardening (2026-10-12, Hermes on CT 104)
- [x] Replace seeded credentials before exposing the hostname — `trainer`, `student`, `student2` rotated with random 14-char secrets (bcrypt cost 12, same as `src/lib/password.ts`); hashes written directly to the live DB; plaintext only in `/root/assessment-credentials.txt` (chmod 600, on the CT). Verified trainer login via API (200 + trainer session works). User account `Osamah` untouched.
- [x] Hide demo login shortcuts on `/login` — verified: no demo-credential block exists on the login page (README wording corrected accordingly).
- [x] Move `SESSION_SECRET` out of `docker-compose.yml` into `.env` (chmod 600); compose reads `${SESSION_SECRET}` with a safe dev fallback; per-install value regenerated.
- [x] `SESSION_COOKIE_SECURE=true` explicit via `docker-compose.override.yml`.
- [x] SQLite WAL mode enabled (better concurrency for parallel student sessions).
- [x] SQLite backups: `scripts/backup-db.sh` (online `.backup` + uploads tar, 7 generations) + `/etc/cron.d/assessment-backup` daily 03:15; first run verified (`dev-20261012-1442.db`).
- [x] Proxmox vzdump backup job `backup-ct104` (daily 04:15, local, zstd, keep-daily=1/weekly=1/monthly=1) + first manual backup verified.
- [x] Docker log rotation via `/etc/docker/daemon.json` (json-file, 10 MB × 3).
- [x] Webfont copy step runs in Docker builds (`npm run copy:webfonts` in builder stage) — verified in image.
- [x] `.dockerignore` excludes `.env*` (except `.env.example`) and `data/`; secrets and DB can no longer leak into build context/images.
- [x] README: corrected false auto-init claim + documented the extraction fix, UID-1001 chown requirement, and a full production runbook (live deployment, updates, schema changes, backups, credentials).
- [x] End-to-end verification: public HTTPS 200, LAN 200, trainer login API 200, `/api/users` 200 with session.

### Server deployment live (2026-10-12, Hermes on CT 104)
- [x] Docker execution inside the unprivileged LXC verified (app container running; no isolation changes needed).
- [x] Domain on Cloudflare, public hostname `assessment.entropy-manager.de` mapped to `http://192.168.178.36:3000` via cloudflared on the CT host; HTTPS live.
- [x] Deployment dir `/opt/assessment-dashboard` with persistent `data/dev.db` + `data/uploads/` on the CT filesystem.
- [x] First-run DB initialization fixed: seeded DB extracted from the built image into the bind-mount target before first start (persistence across recreations, no reseed).
- [x] Unique per-install SESSION_SECRET generated and injected via compose.
- [x] Open WebUI AI assist configured (base URL, model, API key via `.env`).

### Clinical AI curriculum (2026-10-12)
- [x] Foundation Models and Agentic Systems: 12 questions each, four per Easy / Medium / Hard level
- [x] Clinical cases with MC choices, worked solutions, explanations, and primary concept references
- [x] Fresh-seed integration and additive `db:add:clinical-ai` import preserving existing data

### MATLAB coding language (2026-09-03)
- [x] `CodingLanguage.MATLAB` + fill-in-the-blank IDE (`script.m`); Run via RunMat WASM (unpkg)
- [x] Language registry in `src/lib/coding.ts`; trainer language select; student GET still hides blanks
- [x] Seeded MATLAB category: Dice (`.*`) (ML-1) and 1-based indexing (ML-2)

### Coding exercises in-task IDE (2026-09-03)
- [x] `CODING` question type with `____` blanks, Python/JS/MATLAB runner, auto-grade on submit
- [x] Trainer authoring in the question editor; student three-pane IDE (instructions / editor / output)
- [x] Seeded Dice coefficient + Dataset `__len__`/`__getitem__` exercises (Python) plus MATLAB Dice + indexing

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
- [x] Header: display name + progress chip + student "My tasks" nav
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
