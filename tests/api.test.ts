import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { ChildProcess } from "node:child_process";
import {
  apiFetch,
  createCookieJar,
  login,
  startTestServer,
  stopTestServer,
} from "./helpers";

type QuestionDto = {
  id: string;
  title: string;
  type: "FREE_TEXT" | "MULTIPLE_CHOICE";
  choices: Array<{ id: string; label: string; isCorrect?: boolean }>;
  answered: boolean;
};

describe("API integration", () => {
  let server: ChildProcess | undefined;

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await stopTestServer(server);
  });

  test("auth: rejects invalid credentials and accepts demo student/trainer", async () => {
    const bad = await login("student", "wrong-password");
    assert.equal(bad.res.status, 401);
    assert.match(String(bad.data.error ?? ""), /invalid/i);

    const student = await login("student", "student");
    assert.equal(student.res.status, 200);
    assert.equal(student.data.ok, true);
    assert.equal(student.data.redirectTo, "/student");

    const trainer = await login("trainer", "NRAD2026");
    assert.equal(trainer.res.status, 200);
    assert.equal(trainer.data.redirectTo, "/trainer");
  });

  test("assignment filter: student2 sees a CT-focused subset of student", async () => {
    const full = await login("student", "student");
    const fullRes = await apiFetch(full.jar, "/api/questions");
    assert.equal(fullRes.status, 200);
    const fullBody = (await fullRes.json()) as {
      questions: QuestionDto[];
      assignmentMode: boolean;
    };
    assert.equal(fullBody.assignmentMode, true);
    assert.ok(fullBody.questions.length > 0);

    const focused = await login("student2", "student2");
    const focusedRes = await apiFetch(focused.jar, "/api/questions");
    assert.equal(focusedRes.status, 200);
    const focusedBody = (await focusedRes.json()) as {
      questions: QuestionDto[];
      assignmentMode: boolean;
    };
    assert.equal(focusedBody.assignmentMode, true);
    assert.ok(focusedBody.questions.length > 0);
    assert.ok(
      focusedBody.questions.length < fullBody.questions.length,
      `expected student2 (${focusedBody.questions.length}) < student (${fullBody.questions.length})`,
    );

    const fullIds = new Set(fullBody.questions.map((q) => q.id));
    for (const q of focusedBody.questions) {
      assert.ok(fullIds.has(q.id), `unexpected question for student2: ${q.title}`);
    }

    // MRI-heavy titles from the seed should not appear for student2.
    const mriHeavy = focusedBody.questions.filter((q) =>
      /mri|flair|bias field|multi-sequence mri/i.test(q.title),
    );
    assert.equal(mriHeavy.length, 0);
  });

  test("MC submit: student can answer an assigned MC question", async () => {
    const { jar } = await login("student", "student");
    const listRes = await apiFetch(jar, "/api/questions");
    assert.equal(listRes.status, 200);
    const list = (await listRes.json()) as { questions: QuestionDto[] };

    const mc = list.questions.find(
      (q) => q.type === "MULTIPLE_CHOICE" && q.choices.length > 0,
    );
    assert.ok(mc, "expected at least one multiple-choice question");

    const choice = mc.choices[0];
    const submitRes = await apiFetch(jar, "/api/submissions", {
      method: "POST",
      body: JSON.stringify({
        questionId: mc.id,
        selectedChoiceId: choice.id,
      }),
    });
    assert.equal(submitRes.status, 200);
    const submitBody = (await submitRes.json()) as {
      ok: boolean;
      submission: { selectedChoiceId: string | null };
      grading: { isCorrect: boolean } | null;
    };
    assert.equal(submitBody.ok, true);
    assert.equal(submitBody.submission.selectedChoiceId, choice.id);
    assert.ok(submitBody.grading);
    assert.equal(typeof submitBody.grading.isCorrect, "boolean");

    const again = await apiFetch(jar, "/api/questions");
    const againBody = (await again.json()) as {
      questions: QuestionDto[];
      progress: {
        mcAnswered: number;
        mcCorrect: number;
        mcScorePct: number | null;
      };
    };
    const updated = againBody.questions.find((q) => q.id === mc.id);
    assert.ok(updated?.answered);
    assert.ok(againBody.progress.mcAnswered >= 1);

    // Trainer scoreboard includes MC stats.
    const trainer = await login("trainer", "NRAD2026");
    const boardRes = await apiFetch(trainer.jar, "/api/submissions");
    assert.equal(boardRes.status, 200);
    const board = (await boardRes.json()) as {
      scoreboard: Array<{
        username: string;
        mcAnswered: number;
        mcCorrect: number;
        mcScorePct: number | null;
      }>;
    };
    const studentRow = board.scoreboard.find((s) => s.username === "student");
    assert.ok(studentRow);
    assert.ok(studentRow.mcAnswered >= 1);

    // AI review requires trainer + free-text; unauthenticated fails.
    const free = list.questions.find((q) => q.type === "FREE_TEXT");
    if (free) {
      await apiFetch(jar, "/api/submissions", {
        method: "POST",
        body: JSON.stringify({
          questionId: free.id,
          textAnswer: "Short test answer for AI route auth checks.",
        }),
      });
      const trainerSubs = await apiFetch(trainer.jar, "/api/submissions");
      const trainerSubsBody = (await trainerSubs.json()) as {
        submissions: Array<{
          id: string;
          question: { id: string; type: string };
          user: { username: string };
        }>;
      };
      const ft = trainerSubsBody.submissions.find(
        (s) =>
          s.user.username === "student" &&
          s.question.type === "FREE_TEXT" &&
          s.question.id === free.id,
      );
      assert.ok(ft);
      const anonAi = await apiFetch(
        createCookieJar(),
        `/api/submissions/${ft.id}/ai-review`,
        { method: "POST" },
      );
      assert.equal(anonAi.status, 401);
      const aiRes = await apiFetch(
        trainer.jar,
        `/api/submissions/${ft.id}/ai-review`,
        { method: "POST" },
      );
      // 503 when AI env not configured in test; 502/200 if somehow configured.
      assert.ok([200, 502, 503].includes(aiRes.status));
    }

    // Unauthenticated submit fails.
    const anon = createCookieJar();
    const anonRes = await apiFetch(anon, "/api/submissions", {
      method: "POST",
      body: JSON.stringify({
        questionId: mc.id,
        selectedChoiceId: choice.id,
      }),
    });
    assert.equal(anonRes.status, 401);
  });

  test("assignment templates: trainer CRUD; student and anonymous are unauthorized", async () => {
    const student = await login("student", "student");
    const studentGet = await apiFetch(student.jar, "/api/assignment-templates");
    assert.equal(studentGet.status, 401);

    const anonPost = await apiFetch(createCookieJar(), "/api/assignment-templates", {
      method: "POST",
      body: JSON.stringify({ name: "Nope", questionIds: [] }),
    });
    assert.equal(anonPost.status, 401);

    const trainer = await login("trainer", "NRAD2026");
    const bankRes = await apiFetch(trainer.jar, "/api/assignments");
    assert.equal(bankRes.status, 200);
    const bank = (await bankRes.json()) as {
      questions: Array<{ id: string }>;
    };
    const ids = bank.questions.slice(0, 3).map((q) => q.id);
    assert.ok(ids.length >= 1);

    const createdRes = await apiFetch(trainer.jar, "/api/assignment-templates", {
      method: "POST",
      body: JSON.stringify({ name: "API test template", questionIds: ids }),
    });
    assert.equal(createdRes.status, 201);
    const created = (await createdRes.json()) as {
      template: { id: string; name: string; questionCount: number };
    };
    assert.equal(created.template.name, "API test template");
    assert.equal(created.template.questionCount, ids.length);

    const clash = await apiFetch(trainer.jar, "/api/assignment-templates", {
      method: "POST",
      body: JSON.stringify({ name: "API test template", questionIds: ids }),
    });
    assert.equal(clash.status, 409);

    const listRes = await apiFetch(trainer.jar, "/api/assignment-templates");
    assert.equal(listRes.status, 200);
    const list = (await listRes.json()) as {
      templates: Array<{ id: string; name: string }>;
    };
    assert.ok(list.templates.some((t) => t.id === created.template.id));

    const updatedRes = await apiFetch(
      trainer.jar,
      `/api/assignment-templates/${created.template.id}`,
      {
        method: "PUT",
        body: JSON.stringify({ questionIds: ids.slice(0, 1) }),
      },
    );
    assert.equal(updatedRes.status, 200);
    const updated = (await updatedRes.json()) as {
      template: { questionCount: number };
    };
    assert.equal(updated.template.questionCount, 1);

    const delRes = await apiFetch(
      trainer.jar,
      `/api/assignment-templates/${created.template.id}`,
      { method: "DELETE" },
    );
    assert.equal(delRes.status, 200);
  });

  test("question bank CSV export: trainer download; anonymous 401", async () => {
    const anon = await apiFetch(
      createCookieJar(),
      "/api/questions/export?format=csv",
    );
    assert.equal(anon.status, 401);

    const trainer = await login("trainer", "NRAD2026");
    const res = await apiFetch(trainer.jar, "/api/questions/export?format=csv");
    assert.equal(res.status, 200);
    const ctype = res.headers.get("content-type") ?? "";
    assert.match(ctype, /text\/csv/i);
    const text = await res.text();
    assert.match(text, /categorySlug/);
    assert.ok(text.split("\n").length > 2);
  });

  test("time spent: student can record time; trainer cannot; invalid delta rejected", async () => {
    const student = await login("student", "student");
    const listRes = await apiFetch(student.jar, "/api/questions");
    const list = (await listRes.json()) as { questions: QuestionDto[] };
    const qid = list.questions[0]?.id;
    assert.ok(qid);

    const badDelta = await apiFetch(student.jar, "/api/time-spent", {
      method: "POST",
      body: JSON.stringify({ questionId: qid, deltaMs: 10 }),
    });
    assert.equal(badDelta.status, 400);

    const first = await apiFetch(student.jar, "/api/time-spent", {
      method: "POST",
      body: JSON.stringify({ questionId: qid, deltaMs: 5000 }),
    });
    assert.equal(first.status, 200);
    const firstBody = (await first.json()) as { timeSpentMs: number };
    assert.ok(firstBody.timeSpentMs >= 5000);

    const second = await apiFetch(student.jar, "/api/time-spent", {
      method: "POST",
      body: JSON.stringify({ questionId: qid, deltaMs: 2000 }),
    });
    assert.equal(second.status, 200);
    const secondBody = (await second.json()) as { timeSpentMs: number };
    assert.ok(secondBody.timeSpentMs >= firstBody.timeSpentMs + 2000);

    const trainer = await login("trainer", "NRAD2026");
    const trainerRes = await apiFetch(trainer.jar, "/api/time-spent", {
      method: "POST",
      body: JSON.stringify({ questionId: qid, deltaMs: 1000 }),
    });
    assert.equal(trainerRes.status, 401);

    const anon = await apiFetch(createCookieJar(), "/api/time-spent", {
      method: "POST",
      body: JSON.stringify({ questionId: qid, deltaMs: 1000 }),
    });
    assert.equal(anon.status, 401);
  });

  test("clone, grade, categories, users, import, and media", async () => {
    const student = await login("student", "student");
    const trainer = await login("trainer", "NRAD2026");

    const studentClone = await apiFetch(student.jar, "/api/questions/x/clone", {
      method: "POST",
    });
    assert.equal(studentClone.status, 401);

    const bankRes = await apiFetch(trainer.jar, "/api/assignments");
    const bank = (await bankRes.json()) as {
      questions: Array<{ id: string; type: string }>;
    };
    const sourceId = bank.questions[0]?.id;
    assert.ok(sourceId);

    const cloneRes = await apiFetch(
      trainer.jar,
      `/api/questions/${sourceId}/clone`,
      { method: "POST" },
    );
    assert.equal(cloneRes.status, 201);
    const cloned = (await cloneRes.json()) as {
      question: { id: string; title: string };
    };
    assert.match(cloned.question.title, /copy of/i);

    const listRes = await apiFetch(student.jar, "/api/questions");
    const list = (await listRes.json()) as { questions: QuestionDto[] };
    const free = list.questions.find((q) => q.type === "FREE_TEXT");
    assert.ok(free);
    const submitRes = await apiFetch(student.jar, "/api/submissions", {
      method: "POST",
      body: JSON.stringify({
        questionId: free.id,
        textAnswer: "Grade-me test answer.",
      }),
    });
    assert.equal(submitRes.status, 200);

    const subsRes = await apiFetch(trainer.jar, "/api/submissions");
    const subs = (await subsRes.json()) as {
      submissions: Array<{
        id: string;
        question: { id: string; type: string };
        user: { username: string };
      }>;
    };
    const target = subs.submissions.find(
      (s) => s.user.username === "student" && s.question.id === free.id,
    );
    assert.ok(target);

    const studentGrade = await apiFetch(
      student.jar,
      `/api/submissions/${target.id}/grade`,
      { method: "PATCH", body: JSON.stringify({ trainerScore: 80 }) },
    );
    assert.equal(studentGrade.status, 401);

    const gradeRes = await apiFetch(
      trainer.jar,
      `/api/submissions/${target.id}/grade`,
      {
        method: "PATCH",
        body: JSON.stringify({
          trainerScore: 80,
          trainerPassed: true,
          trainerComment: "Solid.",
          feedbackReleased: true,
        }),
      },
    );
    assert.equal(gradeRes.status, 200);
    const graded = (await gradeRes.json()) as {
      submission: { trainerScore: number; feedbackReleased: boolean };
    };
    assert.equal(graded.submission.trainerScore, 80);
    assert.equal(graded.submission.feedbackReleased, true);

    const catRes = await apiFetch(trainer.jar, "/api/categories", {
      method: "POST",
      body: JSON.stringify({
        name: "API Test Cat",
        slug: "api-test-cat",
        icon: "fa-flask",
        color: "teal",
      }),
    });
    assert.equal(catRes.status, 201);
    const cat = (await catRes.json()) as { category: { id: string } };
    const delCat = await apiFetch(
      trainer.jar,
      `/api/categories/${cat.category.id}`,
      { method: "DELETE" },
    );
    assert.equal(delCat.status, 200);

    const userRes = await apiFetch(trainer.jar, "/api/users", {
      method: "POST",
      body: JSON.stringify({
        username: "apitestuser",
        displayName: "API Test User",
        password: "testpass1",
        role: "STUDENT",
      }),
    });
    assert.equal(userRes.status, 201);

    const importRes = await apiFetch(trainer.jar, "/api/questions/import", {
      method: "POST",
      body: JSON.stringify({
        questions: [
          {
            categorySlug: "python",
            title: "Imported API test question",
            prompt: "What is 2+2?",
            roundLabel: "API",
            tags: "Test",
            type: "FREE_TEXT",
            solution: {
              idealAnswer: "4",
              explanation: "Basic arithmetic.",
            },
          },
        ],
      }),
    });
    assert.equal(importRes.status, 200);
    const imported = (await importRes.json()) as { created: number };
    assert.equal(imported.created, 1);

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), "dot.png");
    const mediaRes = await apiFetch(trainer.jar, "/api/media", {
      method: "POST",
      body: form,
    });
    assert.equal(mediaRes.status, 200);
    const media = (await mediaRes.json()) as { url: string };
    assert.match(media.url, /^\/uploads\/.+\.png$/);

    const studentMedia = await apiFetch(student.jar, "/api/media", {
      method: "POST",
      body: form,
    });
    assert.equal(studentMedia.status, 401);
  });
});
