/* eslint-disable no-undef */
const RUNMAT_BASE = "https://unpkg.com/runmat@0.6.2/dist";
const RUNMAT_INDEX = `${RUNMAT_BASE}/index.js`;
const RUNMAT_WASM = `${RUNMAT_BASE}/pkg-web/runmat_wasm_web_bg.wasm`;

let sessionPromise = null;

function textFromEntries(entries) {
  if (entries == null) return "";
  if (typeof entries === "string") return entries;
  if (typeof entries === "number" || typeof entries === "boolean") {
    return String(entries);
  }
  if (!Array.isArray(entries)) {
    if (typeof entries === "object") {
      return String(
        entries.text ?? entries.message ?? entries.data ?? "",
      );
    }
    return String(entries);
  }
  return entries
    .map((entry) => {
      if (entry == null) return "";
      if (typeof entry === "string") return entry;
      if (typeof entry === "object") {
        return String(entry.text ?? entry.message ?? entry.data ?? "");
      }
      return String(entry);
    })
    .filter(Boolean)
    .join("");
}

function streamText(entries, stream) {
  if (!Array.isArray(entries)) return "";
  return entries
    .filter((entry) => entry && typeof entry === "object" && entry.stream === stream)
    .map((entry) => String(entry.text ?? ""))
    .join("");
}

function formatError(err) {
  if (!err) return "MATLAB run failed.";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || String(err);
  if (typeof err === "object") {
    return String(
      err.message ?? err.diagnostic ?? err.details ?? JSON.stringify(err),
    );
  }
  return String(err);
}

async function getSession(id) {
  if (!sessionPromise) {
    self.postMessage({ id, status: "loading" });
    sessionPromise = (async () => {
      const mod = await import(/* webpackIgnore: true */ RUNMAT_INDEX);
      const fsProvider =
        typeof mod.createInMemoryFsProvider === "function"
          ? mod.createInMemoryFsProvider()
          : undefined;
      return mod.initRunMat({
        language: { compat: "matlab" },
        telemetryConsent: false,
        enableGpu: false,
        wasmModule: RUNMAT_WASM,
        fsProvider,
      });
    })();
  }
  return sessionPromise;
}

self.onmessage = async (event) => {
  const { id, code } = event.data ?? {};
  try {
    const session = await getSession(id);
    let result;
    try {
      await session.executeRequest({
        source: { kind: "text", name: "<reset>", text: "clear" },
      });
    } catch {
      // Ignore workspace reset failures and still try the student script.
    }
    result = await session.executeRequest({
      source: {
        kind: "text",
        name: "script.m",
        text: String(code ?? ""),
      },
    });

    const stdoutEntries = result?.stdout;
    let stdout = streamText(stdoutEntries, "stdout");
    let stderr = streamText(stdoutEntries, "stderr");
    if (!stdout && !stderr) {
      stdout = textFromEntries(stdoutEntries);
    }
    const display = textFromEntries(result?.displayEvents);
    const valueText = typeof result?.valueText === "string" ? result.valueText : "";
    if (display) {
      stdout = stdout ? `${stdout}${stdout.endsWith("\n") ? "" : "\n"}${display}` : display;
    } else if (!stdout && valueText) {
      stdout = valueText;
    }

    const error = result?.error;
    if (error) {
      self.postMessage({
        id,
        ok: false,
        stdout,
        stderr: stderr ? `${stderr}\n${formatError(error)}` : formatError(error),
      });
      return;
    }

    self.postMessage({
      id,
      ok: true,
      stdout,
      stderr,
    });
  } catch (err) {
    sessionPromise = null;
    self.postMessage({
      id,
      ok: false,
      stdout: "",
      stderr: formatError(err),
    });
  }
};
