import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  BLANK_TOKEN,
  answersMatch,
  countBlanks,
  encodeCodingAnswer,
  fillBlanks,
  gradeBlanks,
  parseCodingAnswer,
  scaffoldLines,
} from "../src/lib/coding";

describe("coding blanks", () => {
  test("counts and fills ____ placeholders", () => {
    const starter = "a = ____\nb = ____(a)\nprint(b)\n";
    assert.equal(countBlanks(starter), 2);
    assert.equal(
      fillBlanks(starter, ["1", "str"]),
      "a = 1\nb = str(a)\nprint(b)\n",
    );
    const lines = scaffoldLines(starter);
    assert.equal(lines.length, 4);
    assert.deepEqual(lines[0].blankIndices, [0]);
    assert.deepEqual(lines[1].blankIndices, [1]);
  });

  test("grades blanks with | alternatives and whitespace", () => {
    const expected = ["sum(xs)", "__len__|len"];
    const wrong = gradeBlanks(expected, ["len(xs)", "size"]);
    assert.equal(wrong.isCorrect, false);
    assert.deepEqual(wrong.blankResults, [false, false]);

    const ok = gradeBlanks(expected, ["  sum(xs)  ", "len"]);
    assert.equal(ok.isCorrect, true);
    assert.equal(ok.correctCount, 2);
    assert.equal(answersMatch("sum(pred) | sum( pred )", "sum(pred)"), true);
  });

  test("round-trips the submitted payload", () => {
    const json = encodeCodingAnswer(["sum"], `print(${BLANK_TOKEN})`);
    const parsed = parseCodingAnswer(json);
    assert.ok(parsed);
    assert.equal(parsed.v, 1);
    assert.deepEqual(parsed.blanks, ["sum"]);
  });
});
