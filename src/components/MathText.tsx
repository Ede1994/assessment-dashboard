"use client";

import { useEffect, useRef } from "react";
import katex from "katex";

const VIDEO_EXT = /\.(mp4|webm|ogg)(\?.*)?$/i;

/** Renders text with $...$ / $$...$$ KaTeX and optional ![alt](url) images/videos. */
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

    type Part =
      | { type: "text"; value: string }
      | { type: "math"; value: string; display: boolean }
      | { type: "media"; alt: string; src: string };

    const parts: Part[] = [];
    const regex = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|!\[([^\]]*)\]\(([^)\s]+)\)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > last) {
        parts.push({ type: "text", value: text.slice(last, match.index) });
      }
      if (match[1] !== undefined) {
        parts.push({ type: "math", value: match[1], display: true });
      } else if (match[2] !== undefined) {
        parts.push({ type: "math", value: match[2], display: false });
      } else {
        parts.push({ type: "media", alt: match[3] ?? "", src: match[4] ?? "" });
      }
      last = match.index + match[0].length;
    }
    if (last < text.length) {
      parts.push({ type: "text", value: text.slice(last) });
    }

    el.innerHTML = "";
    for (const part of parts) {
      if (part.type === "text") {
        const span = document.createElement("span");
        span.textContent = part.value;
        el.appendChild(span);
      } else if (part.type === "media") {
        if (VIDEO_EXT.test(part.src)) {
          const video = document.createElement("video");
          video.src = part.src;
          video.controls = true;
          video.preload = "metadata";
          video.className =
            "my-3 max-w-full rounded-lg border border-slate-700 bg-slate-950";
          if (part.alt) video.setAttribute("aria-label", part.alt);
          el.appendChild(video);
        } else {
          const img = document.createElement("img");
          img.src = part.src;
          img.alt = part.alt || "Question figure";
          img.className =
            "my-3 max-w-full rounded-lg border border-slate-700 bg-slate-950";
          img.loading = "lazy";
          el.appendChild(img);
        }
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

  return (
    <div ref={ref} className={`whitespace-pre-wrap break-words ${className}`} />
  );
}
