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
    };
    assert.equal(submitBody.ok, true);
    assert.equal(submitBody.submission.selectedChoiceId, choice.id);

    const again = await apiFetch(jar, "/api/questions");
    const againBody = (await again.json()) as { questions: QuestionDto[] };
    const updated = againBody.questions.find((q) => q.id === mc.id);
    assert.ok(updated?.answered);

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
});
