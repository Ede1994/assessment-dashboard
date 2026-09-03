import { codingMeta } from "@/lib/coding";

export type CodeRunResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  loading?: boolean;
};

type WorkerMessage = {
  id?: number;
  ok?: boolean;
  stdout?: string;
  stderr?: string;
  status?: string;
};

export function runStudentCode(
  language: string,
  code: string,
  timeoutMs?: number,
): { promise: Promise<CodeRunResult>; cancel: () => void } {
  const meta = codingMeta(language);
  const limit = timeoutMs ?? meta.timeoutMs;
  let worker: Worker | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let settled = false;

  const promise = new Promise<CodeRunResult>((resolve) => {
    const finish = (result: CodeRunResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      worker?.terminate();
      worker = null;
      resolve(result);
    };

    try {
      worker = new Worker(
        meta.workerUrl,
        meta.workerType === "module" ? { type: "module" } : undefined,
      );
    } catch {
      finish({
        ok: false,
        stdout: "",
        stderr: "Could not start the code runner in this browser.",
      });
      return;
    }

    const id = Date.now();
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const data = event.data ?? {};
      if (data.id !== id && data.id != null) return;
      if (data.status === "loading") {
        return;
      }
      finish({
        ok: Boolean(data.ok),
        stdout: String(data.stdout ?? ""),
        stderr: String(data.stderr ?? ""),
      });
    };
    worker.onerror = (event) => {
      finish({
        ok: false,
        stdout: "",
        stderr: event.message || "Code runner failed.",
      });
    };
    timer = setTimeout(() => {
      finish({
        ok: false,
        stdout: "",
        stderr: `Timed out after ${Math.round(limit / 1000)}s.`,
      });
    }, limit);
    worker.postMessage({ id, code });
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      worker?.terminate();
      worker = null;
    },
  };
}
