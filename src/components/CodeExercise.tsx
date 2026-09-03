"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  BLANK_TOKEN,
  codingFileName,
  encodeCodingAnswer,
  fillBlanks,
  parseCodingAnswer,
  scaffoldLines,
} from "@/lib/coding";
import { runStudentCode, type CodeRunResult } from "@/lib/codeRunner";

type CodeExerciseProps = {
  starterCode: string;
  language: string;
  savedAnswer?: string | null;
  locked?: boolean;
  saving?: boolean;
  message?: string;
  error?: string;
  blankResults?: boolean[] | null;
  onSubmit: (payload: { blanks: string[]; code: string; textAnswer: string }) => void;
  onDraftChange?: (textAnswer: string) => void;
};

function emptyBlanks(count: number, saved?: string[]): string[] {
  return Array.from({ length: count }, (_, i) => saved?.[i] ?? "");
}

export function CodeExercise({
  starterCode,
  language,
  savedAnswer,
  locked = false,
  saving = false,
  message = "",
  error = "",
  blankResults = null,
  onSubmit,
  onDraftChange,
}: CodeExerciseProps) {
  const lines = useMemo(() => scaffoldLines(starterCode), [starterCode]);
  const blankCount = useMemo(
    () => lines.reduce((sum, line) => sum + line.blankIndices.length, 0),
    [lines],
  );
  const [blanks, setBlanks] = useState(() =>
    emptyBlanks(blankCount, parseCodingAnswer(savedAnswer)?.blanks),
  );
  const [output, setOutput] = useState<CodeRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [pythonHint, setPythonHint] = useState("");
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const runHandle = useRef<{ cancel: () => void } | null>(null);
  const hydratedStarter = useRef<string | null>(null);

  useEffect(() => {
    if (hydratedStarter.current === starterCode) return;
    hydratedStarter.current = starterCode;
    setBlanks(emptyBlanks(blankCount, parseCodingAnswer(savedAnswer)?.blanks));
    setOutput(null);
    setPythonHint("");
  }, [starterCode, blankCount, savedAnswer]);

  useEffect(() => {
    if (!onDraftChange) return;
    const code = fillBlanks(starterCode, blanks);
    onDraftChange(encodeCodingAnswer(blanks, code));
  }, [blanks, starterCode, onDraftChange]);

  useEffect(() => {
    return () => {
      runHandle.current?.cancel();
    };
  }, []);

  function updateBlank(index: number, value: string) {
    setBlanks((prev) => prev.map((item, i) => (i === index ? value : item)));
  }

  function resetBlanks() {
    setBlanks(emptyBlanks(blankCount));
    setOutput(null);
  }

  async function runCode() {
    if (running || locked) return;
    const code = fillBlanks(starterCode, blanks);
    if (code.includes(BLANK_TOKEN)) {
      setOutput({
        ok: false,
        stdout: "",
        stderr: "Fill every blank before running.",
      });
      return;
    }
    runHandle.current?.cancel();
    setRunning(true);
    setOutput(null);
    if (language !== "JAVASCRIPT") {
      setPythonHint("Loading Python runtime (first run may take a few seconds)…");
    }
    const handle = runStudentCode(language, code);
    runHandle.current = handle;
    const result = await handle.promise;
    setPythonHint("");
    setRunning(false);
    setOutput(result);
  }

  function submit() {
    if (locked || saving) return;
    const code = fillBlanks(starterCode, blanks);
    onSubmit({
      blanks,
      code,
      textAnswer: encodeCodingAnswer(blanks, code),
    });
  }

  const fileName = codingFileName(language);

  return (
    <div className="flex flex-col min-h-0 flex-1 border border-slate-800 rounded-2xl overflow-hidden bg-slate-900">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-2 min-w-0">
          <i className="fa-solid fa-code text-sky-400 text-xs" />
          <span className="text-xs font-medium text-slate-200 truncate">
            {fileName}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-slate-500 border border-slate-800 rounded px-1.5 py-0.5">
            {language === "JAVASCRIPT" ? "JavaScript" : "Python"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetBlanks}
            disabled={locked}
            className="text-xs px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 hover:border-slate-600 disabled:opacity-40"
            title="Reset blanks"
          >
            <i className="fa-solid fa-rotate-left mr-1.5" />
            Reset
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-[12rem] overflow-auto bg-[#0b1220] coding-editor">
        <div className="flex font-mono text-[13px] leading-6 min-w-max">
          <div
            className="select-none text-right pr-3 pl-3 py-3 text-slate-600 border-r border-slate-800/80 sticky left-0 bg-[#0b1220]"
            aria-hidden
          >
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <pre className="flex-1 py-3 pr-4 pl-3 text-slate-200 m-0">
            <code>
              {lines.map((line, li) => (
                <div key={li} className="min-h-6 whitespace-pre">
                  {line.textSegs.map((seg, si) => {
                    const blankIndex = line.blankIndices[si];
                    return (
                      <Fragment key={`${li}-${si}`}>
                        <span>{seg}</span>
                        {blankIndex != null ? (
                          <input
                            ref={(el) => {
                              inputRefs.current[blankIndex] = el;
                            }}
                            value={blanks[blankIndex] ?? ""}
                            disabled={locked}
                            aria-label={`Blank ${blankIndex + 1}`}
                            placeholder={BLANK_TOKEN}
                            onChange={(e) =>
                              updateBlank(blankIndex, e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Tab" && !e.shiftKey) {
                                const next = inputRefs.current[blankIndex + 1];
                                if (next) {
                                  e.preventDefault();
                                  next.focus();
                                }
                              } else if (e.key === "Tab" && e.shiftKey) {
                                const prev = inputRefs.current[blankIndex - 1];
                                if (prev) {
                                  e.preventDefault();
                                  prev.focus();
                                }
                              } else if (
                                (e.metaKey || e.ctrlKey) &&
                                e.key === "Enter"
                              ) {
                                e.preventDefault();
                                void runCode();
                              }
                            }}
                            style={{
                              width: `${Math.max(4, (blanks[blankIndex] || BLANK_TOKEN).length + 1)}ch`,
                            }}
                            className={`coding-blank ${
                              blankResults && blankResults[blankIndex] === false
                                ? "coding-blank-wrong"
                                : blankResults && blankResults[blankIndex]
                                  ? "coding-blank-ok"
                                  : ""
                            }`}
                          />
                        ) : null}
                      </Fragment>
                    );
                  })}
                </div>
              ))}
            </code>
          </pre>
        </div>
      </div>

      <div className="border-t border-slate-800 bg-slate-950 flex flex-col min-h-[8rem] max-h-[40%] ">
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-800">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Output
          </span>
          {pythonHint ? (
            <span className="text-[11px] text-amber-300">{pythonHint}</span>
          ) : null}
        </div>
        <pre className="flex-1 overflow-auto px-3 py-2 text-xs text-slate-300 min-h-20">
          {running ? (
            <span className="text-slate-500">Running…</span>
          ) : output ? (
            <>
              {output.stdout ? <span>{output.stdout}</span> : null}
              {output.stderr ? (
                <span className="text-rose-400">
                  {output.stdout ? "\n" : ""}
                  {output.stderr}
                </span>
              ) : null}
              {!output.stdout && !output.stderr ? (
                <span className="text-slate-500">
                  {output.ok ? "(no output)" : "Run failed."}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-slate-600">
              Click Run to execute your filled-in code.
            </span>
          )}
        </pre>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 border-t border-slate-800 bg-slate-900">
        <div className="text-xs space-y-1 min-w-0">
          {error ? (
            <p className="text-rose-400" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-emerald-400" aria-live="polite">
              {message}
            </p>
          ) : null}
          {!error && !message ? (
            <p className="text-slate-500">
              Fill each {BLANK_TOKEN} blank. Tab moves between blanks. Ctrl/⌘+Enter
              runs the code.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runCode()}
            disabled={running || locked}
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-sm hover:border-sky-500/50 disabled:opacity-50"
          >
            <i className="fa-solid fa-play mr-1.5 text-xs" />
            {running ? "Running…" : "Run code"}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || locked}
            className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-medium"
          >
            {saving ? "Saving…" : locked ? "Locked" : "Submit answer"}
          </button>
        </div>
      </div>
    </div>
  );
}
