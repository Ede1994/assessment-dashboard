/** RFC 4180-ish CSV cell escaping. */
export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: Array<Array<string | number | boolean | null | undefined>>): string {
  return rows
    .map((row) =>
      row
        .map((cell) => csvEscape(cell == null ? "" : String(cell)))
        .join(","),
    )
    .join("\n");
}
