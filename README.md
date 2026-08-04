# Student Assessment Platform

Prototype assessment dashboard for medical data engineering students. Dark UI inspired by an interview-prep template, with mock student/trainer logins, SQLite-backed questions/solutions, and mixed free-text / multiple-choice tasks (Python, PyTorch, CT/MRI, DICOM, AI/DL).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Prisma + SQLite (`better-sqlite3` adapter)
- iron-session (cookie mock auth)
- KaTeX for inline math in prompts/solutions

## Setup

```bash
npm install
cp .env.example .env
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Mock logins

| Role    | Username   | Password   | Notes |
|---------|------------|------------|-------|
| Student | `student`  | `student`  | Full assigned curriculum |
| Student | `student2` | `student2` | CT-focused assignment (MRI-heavy tasks omitted) |
| Trainer | `trainer`  | `trainer`  | Review solutions, assign tasks, view answers |

- **Student:** browse assigned tasks only, submit/update answers. Solutions are never shown.
- **Trainer:** overview, full answer key, **Assign tasks** per student, side-by-side submissions vs solutions.

## Assignments

Trainers open **Assign tasks** (`/trainer/assignments`), pick a student, then select individual questions or whole categories (e.g. all CT & DICOM, none of the MRI-only items). Saving replaces that student’s assignment set. Students with no assignments temporarily see the full bank.

## Question bank

Seeded from the medical interview-prep template plus the Deep Learning in Medical Imaging tutor FAQ (English, near-duplicates skipped). Categories: PyTorch, Python, medical data, AI/DL, DL fundamentals, CT & MRI, DICOM, governance/MDR, U-Net architectures. Edit `prisma/seed.ts` / `prisma/tutorQuestionsEn.ts` and run `npm run db:seed`.

## Useful scripts

```bash
npm run dev          # development server
npm run db:push      # sync Prisma schema to SQLite
npm run db:seed      # reset users, questions, and demo assignments
npm run db:reset     # force-reset DB then seed
npm run build        # production build
npm start            # production server (after build); also uses port 3000 by default
```

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

