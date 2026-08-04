"use client";

import { useEffect, useRef } from "react";
import katex from "katex";

/** Renders text with $...$ and $$...$$ KaTeX segments. */
export function MathText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const parts: Array<{ type: "text" | "math"; value: string; display: boolean }> =
      [];
    const regex = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > last) {
        parts.push({
          type: "text",
          value: text.slice(last, match.index),
          display: false,
        });
      }
      if (match[1] !== undefined) {
        parts.push({ type: "math", value: match[1], display: true });
      } else {
        parts.push({ type: "math", value: match[2], display: false });
      }
      last = match.index + match[0].length;
    }
    if (last < text.length) {
      parts.push({ type: "text", value: text.slice(last), display: false });
    }

    el.innerHTML = "";
    for (const part of parts) {
      if (part.type === "text") {
        const span = document.createElement("span");
        span.textContent = part.value;
        el.appendChild(span);
      } else {
        const span = document.createElement(part.display ? "div" : "span");
        try {
          katex.render(part.value, span, {
            throwOnError: false,
            displayMode: part.display,
          });
        } catch {
          span.textContent = part.value;
        }
        el.appendChild(span);
      }
    }
  }, [text]);

  return <div ref={ref} className={className} />;
}
