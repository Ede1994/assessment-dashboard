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
| Auth | Mock only (`iron-session` cookie) | Explicitly out of scope for real auth |
| Answer types | Mix free-text + multiple choice | User choice |
| Solutions visibility | Never on student APIs | Trainer-only via `/api/solutions` and trainer pages |
| Task scoping | Per-student `QuestionAssignment` | e.g. CT track without MRI tasks |
| Empty assignments | If a student has **0** assignments → show **full** bank | Avoid locking demos; curated sets use explicit assignments |

---

## Credentials & demos

| User | Pass | Role | Seed behavior |
|------|------|------|----------------|
| `student` | `student` | STUDENT | All questions assigned (~66) — “full track” |
| `student2` | `student2` | STUDENT | CT-focused: MRI-heavy titles/tags filtered out (~61) |
| `trainer` | `trainer` | TRAINER | Full bank, assignments UI, submissions |

Env: `DATABASE_URL=file:./prisma/dev.db`, `SESSION_SECRET=…` (see `.env.example`). SQLite file lives under `prisma/dev.db` (not repo root).

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
