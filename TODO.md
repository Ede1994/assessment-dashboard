# TODO — Assessment Platform

Living checklist for agents. Mark items `[x]` when done, add new open work under **Open**, and move finished work to **Done** with a short note.

Last updated: 2026-08-04

---

## Open

### Product / features
- [ ] In-UI question bank editor (create/edit/delete questions & solutions) — currently seed/DB only
- [ ] Real authentication (replace mock cookie logins / plaintext passwords)
- [ ] Automated grading for multiple-choice (scoreboard); optional AI-assist for free-text review
- [ ] File uploads (e.g. notebooks, code attachments) on submissions
- [ ] Multi-tenant / class / course model (orgs, cohorts)
- [ ] Trainer can assign by **category presets** in one click (CT-track, MRI-track, PyTorch-only) — partial: category +/- buttons exist; named presets would help
- [ ] Student progress emails / export of submissions (CSV/PDF)
- [ ] German UI locale toggle (content is English by design)

### Engineering / polish
- [ ] Migrate Next.js `middleware` → `proxy` (Next 16 deprecation warning)
- [ ] Commit initial codebase to git (repo was scaffolded; confirm what is pushed)
- [ ] Add minimal automated tests (auth + assignment filter + MC submit)
- [ ] Ensure Font Awesome webfonts resolve reliably in production (CSS import path)
- [ ] CI: `prisma generate` + `db push`/`migrate` + build on PR

### Content
- [ ] Review remaining near-duplicates between template bank and tutor bank
- [ ] Add more CT-only / MRI-only tagged questions for cleaner assignment filters
- [ ] Optional: import more modules from other tutor HTML files if provided

---

## Done

### Prototype platform (sessions 2026-08-04)
- [x] Next.js App Router + TypeScript + Tailwind dark medical UI (from interview-prep HTML look)
- [x] Prisma + SQLite (`better-sqlite3` adapter, Prisma 7)
- [x] Mock logins: `student`/`student`, `student2`/`student2`, `trainer`/`trainer`
- [x] Student routes: list, filter/search, answer free-text & MC (no solutions leaked)
- [x] Trainer routes: overview, question bank + solutions, submissions side-by-side
- [x] Seed English question bank from medical data engineering prep HTML (~16 scenarios + CT/MRI extras)
- [x] Import Q&A from `deep_learning_medizin_tutor.html` → English in `prisma/tutorQuestionsEn.ts` (skip Q1.6, Q2.4 duplicates)
- [x] `QuestionAssignment` model + `/api/assignments` + `/trainer/assignments` UI
- [x] Students only see assigned questions; demo: full track vs CT-focused (`student2`)
- [x] README with setup and credentials
- [x] `TODO.md` + `MEMORY.md` for cross-agent continuity

---

## How agents should update this file

1. When starting work: claim an open item (add `In progress — <agent/session>` under it).
2. When finishing: move to **Done** with date + one-line note; clear in-progress.
3. When discovering new work: add under **Open**; do not delete history from **Done**.
4. Keep bullets short; details belong in `MEMORY.md` or the PR description.
