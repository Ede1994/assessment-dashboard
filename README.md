# Student Assessment Platform

Prototype assessment dashboard for medical data engineering students. Dark UI inspired by an interview-prep template, with bcrypt-backed authentication, SQLite question bank (editable in-UI), per-student task assignment, and mixed free-text / multiple-choice tasks (Python, PyTorch, CT/MRI, DICOM, AI/DL).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Prisma + SQLite (`better-sqlite3` adapter)
- iron-session (signed httpOnly cookies) + **bcrypt** password hashes
- KaTeX for inline math in prompts/solutions

## Requirements

- **Node.js 20+** (22 LTS recommended; see `.nvmrc`)
- **npm 10+**
- macOS, Windows, or **Debian/Ubuntu Linux** (x64 or arm64)

### Debian / Ubuntu system packages

SQLite is provided by `better-sqlite3`, which ships prebuilt binaries for common Linux platforms. You usually do **not** need compilers. If `npm install` still fails while building native modules, install the toolchain once:

```bash
sudo apt-get update
sudo apt-get install -y build-essential python3
```

Recommended Node install (via [nvm](https://github.com/nvm-sh/nvm)):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# restart the shell, then:
nvm install
nvm use
node -v   # should be v22.x
```

Avoid the very old `nodejs` package from default Ubuntu apt repos when possible.

## Setup

```bash
npm install
cp .env.example .env
npm run setup          # checks native SQLite + db push + seed
npm run dev
```

Equivalent manual steps:

```bash
npm install
cp .env.example .env
npx prisma db push
npm run db:seed
npm run check:native   # optional sanity check
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Set `SESSION_SECRET` in `.env` to a random string of **at least 32 characters** (required in production).

### Troubleshooting `npm install` on Linux

| Symptom | Fix |
|--------|-----|
| `gyp ERR!` / `Python` / `make` / `g++` errors | `sudo apt-get install -y build-essential python3` then `rm -rf node_modules && npm install` |
| `GLIBC_… not found` | Use a newer distro (Ubuntu 22.04+ / Debian 12+) or rebuild: `npm rebuild better-sqlite3` after installing build tools |
| Scripts skipped / Prisma engines missing | Ensure project `.npmrc` is present (`ignore-scripts=false`) and re-run `npm install` |
| Wrong Node version | `nvm install && nvm use` (Node 20 or 22) |
## Authentication

Passwords are **never** stored in plaintext. Login verifies against bcrypt hashes. Sessions use encrypted iron-session cookies.

| Action | Who | Where |
|--------|-----|--------|
| Sign in | Anyone with an account | `/login` |
| Self-register (student) | Public | `/register` (min 8-char password) |
| Change password | Logged-in user | `/account` |
| Create student/trainer | Trainer | `/trainer/users` |

### Demo seed accounts (hashed in DB)

| Role    | Username   | Password   | Notes |
|---------|------------|------------|-------|
| Student | `student`  | `student`  | Full assigned curriculum |
| Student | `student2` | `student2` | CT-focused assignment (MRI-heavy tasks omitted) |
| Trainer | `trainer`  | `NRAD2026` | Full trainer tools |

Demo student passwords are short for convenience; **new** registrations and password changes require ≥8 characters.

## Updating the local database after a pull

Seed data (questions, solutions, demo users/passwords, assignments) lives in code (`prisma/seed.ts`, `prisma/tutorQuestionsEn.ts`, `prisma/ctQuestionsEn.ts`). Your local SQLite file `prisma/dev.db` is **not** updated by `git pull` alone.

After pulling changes that touch the schema or seed content:

```bash
git pull
npm install                 # if package.json / lockfile changed
npx prisma generate         # if Prisma schema or client changed
npx prisma db push          # if schema.prisma changed
npm run db:seed             # reload questions, solutions, and demo accounts
```

Or in one shot (force-reset schema + seed):

```bash
npm run db:reset
```

`npm run db:seed` / `db:reset` **wipe** existing users, submissions, and in-UI question edits, then recreate the demo bank. Export or re-enter custom trainer edits before reseeding if you need to keep them.

If only app code changed (no Prisma/seed edits), you do **not** need to reseed — just `npm install` (when needed) and `npm run dev`.

## Roles

- **Student:** assigned tasks only, submit/update answers, change own password. Solutions never shown.
- **Trainer:** question bank CRUD, category editor, assign tasks (presets), review submissions (CSV export), provision users (create / delete / reset password).

## Question bank editor

Trainers manage the bank in the UI (no seed edit required for day-to-day changes):

- **New:** `/trainer/questions/new`
- **Edit:** `/trainer/questions/[id]/edit` (or Edit on each card)
- **Delete / Clone / Preview:** on each card or in compact list view
- **Import / Export:** JSON bank dump via Export JSON / Import JSON on `/trainer/questions` (categories matched by slug), plus **Export CSV** for a spreadsheet-friendly dump
- **Media:** upload image/video in the editor (stored under `/public/uploads`, inserted as `![alt](/uploads/…)` markdown; videos render with controls)

Each question stores prompt, optional code snippet, type (free text / MC + choices), and trainer-only ideal answer / explanation / code solution.

Seed data still bootstraps categories and the initial bank via `npm run db:seed`.

## Assignments

Trainers open **Assign tasks** (`/trainer/assignments`), pick a student, then select individual questions, whole categories (+/−), built-in presets (**CT-track**, **CT-only**, **MRI-track**, **PyTorch-only**), or **saved named templates**. Save the current selection as a reusable template (overwrite if the name already exists). Optional **due date**, **exam mode** (soft-locks MC after first submit), **copy from another student**, and **cohort** multi-select apply the same set to several students at once. Saving replaces each target student’s assignment set. Students with no assignments temporarily see the full bank; due dates appear on the student dashboard with overdue highlighting.

## Keyboard shortcuts

On the student task list, trainer question bank, and assign-tasks list:

| Key | Action |
|-----|--------|
| `/` | Focus search |
| `j` / `↓` | Highlight next item |
| `k` / `↑` | Highlight previous item |
| Enter | Open (student), preview (bank), or toggle (assignments) |
| Esc | Close dialogs or blur search |

## Categories

Trainers manage categories in the UI at `/trainer/categories` (create / rename / recolor / delete when empty). Questions still pick a category in the question editor.

## Question bank content

Seeded from the medical interview-prep template plus the Deep Learning in Medical Imaging tutor FAQ (English, near-duplicates skipped), plus a 10-question CT fundamentals quiz (`prisma/ctQuestionsEn.ts`, with FBP figure at `public/seed-assets/ct/fbp-reconstructions.png`), plus 3 MRI-only items (`prisma/mriQuestionsEn.ts`), plus 36 free-text interview Q&As from [amine0110/Medical-Imaging-Interview-Questions-Answers](https://github.com/amine0110/Medical-Imaging-Interview-Questions-Answers) (`prisma/interviewQuestionsEn.ts`; skipped overlap on class imbalance, metrics overview, and U-Net). Categories: PyTorch, Python, medical data, AI/DL, DL fundamentals, CT & MRI, DICOM, governance/MDR, U-Net architectures.

## Useful scripts

```bash
npm run dev          # development server
npm run db:push      # sync Prisma schema to SQLite
npm run db:seed      # reset users, questions, and demo assignments
npm run db:reset     # force-reset DB then seed
npm run build        # production build
npm start            # production server (after build); also uses port 3000 by default
npm test             # API integration tests (auth, assignments, templates, time spent, clone/grade/users/…)
```

## Grading & scoreboard

- **Multiple choice** is auto-graded from `Choice.isCorrect` when a student saves an answer.
- Students see Correct / Incorrect on their own MC answers (not the answer key for other choices).
- Trainers can **manually grade free-text** on `/trainer/submissions` (score 0–100, pass/fail, comment) and optionally **release feedback** so the student sees it on the answer page.
- Trainers see an **MC scoreboard** on `/trainer` (correct/answered %, completion, free-text count, time spent). Click a student to open their filtered submissions.
- Trainers can **Export CSV** or **Export PDF** (browser print) of filtered submissions on `/trainer/submissions`.
- Question bank **Export CSV** is available next to Export JSON on `/trainer/questions`.
- Trainers can **email a progress digest** for one student (requires SMTP env; see below).
- Question bank supports **Clone** (duplicates prompt, solution, and choices; no submissions).
- **Time spent** on a question is tracked while the answer page is visible (paused when the tab is hidden). Students see a live timer; trainers see totals on the scoreboard and each submission. Viewing time does **not** count as an answer.
- **Light theme** toggle in the header (and on login/register); preference is stored in `localStorage`.

## AI assist (Open WebUI / Ollama)

Trainers can request a free-text review suggestion on `/trainer/submissions`. The app calls an OpenAI-compatible endpoint (Open WebUI → Ollama) using:

| Env | Purpose |
|-----|---------|
| `AI_BASE_URL` | WebUI root, e.g. `http://host:8080` (appends `/api/chat/completions`) |
| `AI_API_KEY` | Bearer API key from WebUI → Settings → Account |
| `AI_MODEL` | Model id (default `llama3.1`) |

Copy from `.env.example`, set the key, restart the app. If unset, the AI button returns a clear configuration error (HTTP 503). Feedback is stored on the submission for the trainer only and does **not** change the student answer.

## Progress emails (SMTP)

Trainers can send a text progress digest from `/trainer/submissions` (select one student → recipient email). Uses nodemailer with:

| Env | Purpose |
|-----|---------|
| `SMTP_HOST` | SMTP server hostname (required) |
| `SMTP_FROM` | From address (required) |
| `SMTP_PORT` | Port (default `587`) |
| `SMTP_SECURE` | `true` for TLS/465 |
| `SMTP_USER` / `SMTP_PASS` | Optional auth |

If SMTP is unset, the send action returns HTTP 503 with a configuration hint.

## Docker (Debian/Ubuntu host)

The image is based on **Debian Bookworm** and includes `node` (22), `npm`, `sqlite3`, plus `build-essential` / `python3` as a fallback for native modules.

```bash
# Build
docker build -t assessment-dashboard .

# Run (http://localhost:3000)
docker run --rm -p 3000:3000 assessment-dashboard

# Or Compose
docker compose up --build
```

Override `SESSION_SECRET` in real deployments:

```bash
docker run --rm -p 3000:3000 \
  -e SESSION_SECRET='replace-with-a-long-random-secret-32+' \
  assessment-dashboard
```

The image ships a seeded SQLite DB. Compose mounts `./data/dev.db` and `./data/uploads` by default so answers and trainer media survive container recreate (create the host files/dirs first if needed).

```bash
mkdir -p data/uploads
touch data/dev.db   # optional; container may create the DB on first run via seed
docker compose up --build
```

## Automated tests

`npm test` seeds `prisma/test.db`, starts the production server on port **3010**, and runs Node’s built-in test runner against:

- auth (invalid login + demo student/trainer)
- assignment filter (`student2` CT-focused subset)
- multiple-choice submit (+ unauthenticated 401)

Requires a prior or automatic `npm run build` (creates `.next` if missing).

## Stopping the application and background processes

The app is a local Node/Next.js process. Closing the browser tab does **not** stop the server. Use the steps below so nothing keeps listening on port 3000 (or another port you chose).

### 1. Preferred: stop the terminal that started it

If you started the app with `npm run dev` or `npm start` in a terminal:

1. Click that terminal window (Terminal.app, iTerm, VS Code/Cursor terminal, etc.).
2. Press **Ctrl+C** once.
3. Wait until the prompt returns. You should no longer see `Ready` / `Local: http://localhost:3000`.
4. If it does not exit, press **Ctrl+C** again. As a last resort in that same shell, press **Ctrl+Z** only if needed, then run `kill %1` (or close that terminal tab) — prefer Ctrl+C over leaving a suspended job.

That usually stops:

- the `npm run dev` / `npm start` wrapper  
- the underlying `next` / `node` child process  

### 2. If the terminal is already closed (orphaned process)

Something may still be bound to port **3000**. On macOS/Linux:

```bash
# Who is using port 3000?
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

Example output shows a `PID` (second column). Stop it:

```bash
kill <PID>
```

If it does not exit within a few seconds:

```bash
kill -9 <PID>
```

One-liner to free port 3000:

```bash
kill $(lsof -t -iTCP:3000 -sTCP:LISTEN) 2>/dev/null || true
```

Force if needed:

```bash
kill -9 $(lsof -t -iTCP:3000 -sTCP:LISTEN) 2>/dev/null || true
```

### 3. Find Next.js / Node processes by name

Useful when you are unsure of the port or started multiple instances:

```bash
# List likely app processes
pgrep -fl "next|assessment-dashboard" || true
ps aux | egrep '[n]ext (dev|start)|[n]ode .*next' || true
```

Stop all Next.js CLI processes for this machine (careful: affects **every** Next app you have running):

```bash
pkill -f "next dev" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
```

Narrower: only processes whose command line includes this project path:

```bash
pkill -f "assessment-dashboard.*next" 2>/dev/null || true
# or:
pkill -f "/Documents/GitHub/assessment-dashboard" 2>/dev/null || true
```

### 4. Production mode (`npm run build` + `npm start`)

Same rules: **Ctrl+C** in that terminal, or free port 3000 with `lsof` / `kill` as above.  
`npm run build` itself exits when finished; it does not leave a long-running server. Only `npm start` (or `npm run dev`) stays in the background.

### 5. Prisma / SQLite

- Prisma CLI commands (`db push`, `db seed`) exit on their own; nothing to stop afterward.
- The SQLite file `prisma/dev.db` is just a file on disk. Stopping the app does **not** delete it. Leave it as-is unless you intentionally reset data with `npm run db:seed` / `db:reset`.

### 6. Verify everything is stopped

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN || echo "Port 3000 is free."
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000 || echo "Server not reachable (expected when stopped)."
```

You want: port 3000 free, and `curl` failing to connect (or connection refused).

