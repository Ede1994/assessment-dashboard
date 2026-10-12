# TODO — Assessment Platform

Living checklist for agents. Mark items `[x]` when done, add new open work under **Open**, and move finished work to **Done** with a short note.

Last updated: 2026-10-12

---

## Progress snapshot (2026-10-12)

Solid prototype: auth, CRUD, assignments, media, bank import/export, grading, AI assist, time-spent tracking, light theme, keyboard nav, Docker, CI, coding exercises (Python / JavaScript / MATLAB fill-in-the-blank IDE), ~143 questions including clinical Foundation Models and Agentic Systems topics. Next priority: **persistent server deployment behind a Cloudflare Tunnel**. Content follow-up: **near-duplicate review** and optional extra tutor HTML imports.

---

## Open

### Server deployment — container preparation (next priority)

Target: **CT 104 — `assessment`**, an unprivileged Proxmox LXC running Ubuntu 24.04 LTS. User-reported allocation: 2 vCores, 4 GB RAM + 512 MB swap, 20 GB root disk on `local-lvm`; `vmbr0` with DHCP, currently `192.168.178.36`; `nesting=1`, `keyctl=1`, CT autostart enabled. Docker Engine 29.1.3, Compose plugin 2.40.3, Git, and curl are installed. These details are reported by the user; the remote runtime has not yet been verified.

Recommended route: browser HTTPS → Cloudflare → `cloudflared` in CT 104 → `http://app:3000` on a shared Docker network. Use one app instance and SQLite, with persistent app data on the CT filesystem. The public hostname is still to be chosen, e.g. `assessment.example.com`.

- [x] Provision CT 104 and install Docker/Compose, Git, and curl (user confirmed).
- [ ] Verify Docker execution inside the unprivileged LXC (`docker run --rm hello-world`), Docker starts at boot, CPU architecture (`uname -m`), and available memory/disk. Investigate actual runtime errors before changing LXC isolation settings.
- [ ] Confirm the domain is on Cloudflare and choose the public hostname; reserve `192.168.178.36` in DHCP if it will be used for administration or a connector outside this CT. A same-network containerized tunnel uses the service name and does not depend on a fixed LAN IP.
- [ ] Choose a deployment directory inside CT 104 (e.g. `/opt/assessment-dashboard`); keep persistent data there or in named Docker volumes. Validate runtime-user writes from Docker; set ownership inside the LXC rather than assuming identical UIDs on the Proxmox host. Check any additional Docker user-namespace mapping if enabled.
- [ ] Add a production Compose configuration with `app` and `cloudflared` on the same network, restart policies, and no publicly published app port. If the connector runs directly on the host instead, bind the app to `127.0.0.1:3000:3000` and route to `http://127.0.0.1:3000`.
- [ ] Replace hardcoded production session secrets with required runtime configuration; generate a unique secret (at least 32 characters, e.g. `openssl rand -base64 48`), keep it stable across restarts, and keep `SESSION_COOKIE_SECURE=true` for public HTTPS. Compose must actually inject the variables; an env file alone does not override the current hardcoded `environment` values.
- [ ] Store the Cloudflare tunnel token as a separate deployment secret available only to `cloudflared`; pin a reviewed connector image version and document token rotation.
- [ ] Fix first-run database initialization: the current `./data/dev.db` bind mount hides the image's seeded database, and `touch data/dev.db` does not create tables. Initialize or restore a real DB before mounting it, or add initialization that runs only when storage is empty; never reseed on every startup.
- [ ] Persist the SQLite database directory (including journal/WAL sidecars) and uploads separately; ensure both are writable by the runtime UID/GID `1001:1001`. Test persistence across container replacement and host reboot.
- [ ] Provide a maintenance image/job with the Prisma/TypeScript tooling and source files needed for schema updates and `db:add:clinical-ai`; the current runtime prunes `tsx`/Prisma CLI and omits `scripts/` and the imported `src/lib` files. Back up before schema changes; content-only updates must preserve submissions and edited questions.
- [ ] Exclude `.env*` (except `.env.example`), deployment secrets, `data/`, uploaded media, and SQLite sidecars from Docker build context; the current `.dockerignore` excludes only `.env`, not `.env.production` or other secret env files. Ignore server data/secrets in Git as well.
- [ ] Run the webfont copy step during clean Docker builds; `npm ci --ignore-scripts` skips the postinstall copy, and a fresh Git checkout has no generated `public/webfonts`.
- [ ] Prepare a production bootstrap/account procedure: replace seeded trainer/student passwords before exposing the hostname, hide demo login shortcuts for public use, and decide whether public self-registration should be enabled or gated.

### Server deployment — tunnel and first launch

- [ ] Create a persistent, remotely managed Cloudflare Tunnel, start the connector on the server, and map the chosen public hostname to the appropriate internal app address. A containerized connector must use `app:3000` on the shared network, not its own `localhost`.
- [ ] Allow outbound tunnel traffic on port `7844` (UDP/QUIC or TCP/HTTP2) and required DNS/build/download traffic; keep inbound app ports closed. Enable public HTTPS and avoid rules that cache authenticated pages or API responses.
- [ ] Decide whether the site is open to app-authenticated users or additionally restricted by Cloudflare Access; for a restricted class/team, configure an explicit Access allow policy before sharing the URL.
- [ ] Add an app readiness/health check and check connector status/logs. Verify real client-IP forwarding and auth rate limiting through the trusted tunnel, HTTPS redirects, secure session cookies, and absence of direct public origin access.
- [ ] Verify trainer/student login, registration policy, assignments, answer submission, solutions restricted to trainers, and media upload/playback through the public hostname. Check that files uploaded after container startup remain available after a restart.
- [ ] Decide whether uploaded media may be publicly accessible: `/public/uploads` currently serves files without app-level authorization. If private media is required, move it outside `public` and serve it through an authenticated route before launch.
- [ ] Configure optional SMTP and Open WebUI through explicit container environment values and reachable service addresses. Container `127.0.0.1` refers to that container; use a service name or a configured host/LAN address for other services. Browser coding runtimes also need access to their public CDNs.

### Server deployment — operations

- [ ] Schedule consistent SQLite backups (online backup API / `sqlite3 .backup`, or stop the app before copying) plus upload backups; keep an off-server copy and verify a restore.
- [ ] Document the release procedure: backup → build/pull a versioned image → run required maintenance → recreate app → check the public hostname; document rollback including DB compatibility. Image rebuilds must not replace the persistent DB or run a destructive seed.
- [ ] Add disk-space/log monitoring and test recovery after server/container/tunnel restart; define how app and connector updates are applied.
- [ ] Account for CT 104's 20 GB disk: measure the first build's disk/RAM use, configure Docker log rotation, retain only needed release/build artifacts, and monitor free space for SQLite/uploads. Keep backup copies off the CT; inspect `docker system df` before any cleanup and preserve data volumes.
- [ ] Update README with a tested deployment runbook, production env example, first-run initialization, backup/restore, and maintenance commands. Correct the existing Docker section's suggestion that an empty mounted DB is initialized automatically.

References: [Cloudflare Tunnel setup](https://developers.cloudflare.com/tunnel/get-started/), [tunnel firewall requirements](https://developers.cloudflare.com/tunnel/configuration/), [Docker Compose networking](https://docs.docker.com/compose/how-tos/networking/), and [bind-mount behavior](https://docs.docker.com/engine/storage/bind-mounts/).

### Product / features
- [ ] (coding exercises shipped)

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

---

## Done

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
