/* eslint-disable no-undef */
self.onmessage = (event) => {
  const { id, code } = event.data ?? {};
  const logs = [];
  const fakeConsole = {
    log: (...args) => logs.push(args.map(stringify).join(" ")),
    info: (...args) => logs.push(args.map(stringify).join(" ")),
    warn: (...args) => logs.push(args.map(stringify).join(" ")),
    error: (...args) => logs.push(args.map(stringify).join(" ")),
  };

  try {
    const fn = new Function("console", String(code ?? ""));
    const result = fn(fakeConsole);
    const stdout = logs.join("\n");
    const extra =
      result === undefined ? "" : stringify(result);
    self.postMessage({
      id,
      ok: true,
      stdout: extra && stdout ? `${stdout}\n${extra}` : stdout || extra,
      stderr: "",
    });
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      stdout: logs.join("\n"),
      stderr: err instanceof Error ? err.message : String(err),
    });
  }
};

function stringify(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
