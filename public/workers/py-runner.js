/* eslint-disable no-undef */
const PYODIDE_INDEX = "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/";

let pyodidePromise = null;

self.onmessage = async (event) => {
  const { id, code } = event.data ?? {};
  try {
    if (!pyodidePromise) {
      self.postMessage({ id, status: "loading" });
      importScripts(`${PYODIDE_INDEX}pyodide.js`);
      pyodidePromise = loadPyodide({ indexURL: PYODIDE_INDEX });
    }
    const pyodide = await pyodidePromise;
    const stdout = [];
    const stderr = [];
    pyodide.setStdout({
      batched: (s) => {
        stdout.push(s);
      },
    });
    pyodide.setStderr({
      batched: (s) => {
        stderr.push(s);
      },
    });
    await pyodide.runPythonAsync(String(code ?? ""));
    self.postMessage({
      id,
      ok: true,
      stdout: stdout.join(""),
      stderr: stderr.join(""),
    });
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      stdout: "",
      stderr: err instanceof Error ? err.message : String(err),
    });
  }
};
