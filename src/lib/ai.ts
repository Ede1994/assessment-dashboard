/**
 * OpenAI-compatible client for Open WebUI (Ollama backend) or similar gateways.
 *
 * Env:
 *   AI_BASE_URL  — e.g. http://host:8080  (WebUI root; /api/chat/completions is appended)
 *                  or full URL ending in /chat/completions
 *   AI_API_KEY   — Bearer token from Open WebUI Settings → Account
 *   AI_MODEL     — model id (e.g. llama3.1)
 */

export type AiReviewResult = {
  feedback: string;
  model: string;
};

function resolveChatCompletionsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  if (trimmed.endsWith("/api")) return `${trimmed}/chat/completions`;
  return `${trimmed}/api/chat/completions`;
}

export function getAiConfig() {
  const baseUrl = process.env.AI_BASE_URL?.trim();
  const apiKey = process.env.AI_API_KEY?.trim();
  const model = process.env.AI_MODEL?.trim() || "llama3.1";
  if (!baseUrl || !apiKey) {
    return null;
  }
  return {
    url: resolveChatCompletionsUrl(baseUrl),
    apiKey,
    model,
  };
}

export async function requestAiFreeTextReview(input: {
  questionTitle: string;
  questionPrompt: string;
  idealAnswer: string;
  explanation: string;
  studentAnswer: string;
}): Promise<AiReviewResult> {
  const config = getAiConfig();
  if (!config) {
    throw new Error(
      "AI assist is not configured. Set AI_BASE_URL and AI_API_KEY (and optionally AI_MODEL).",
    );
  }

  const system = `You are a careful teaching assistant helping a trainer review a student's free-text answer for a medical data engineering / imaging assessment.
Compare the student answer to the ideal solution. Be concise and constructive.
Respond in English with this structure:
1) Verdict: Strong / Partial / Weak
2) What the student got right
3) Gaps or misconceptions vs the ideal answer
4) One short suggestion for the trainer's feedback to the student
Do not invent facts that are not supported by the ideal answer or student text.
Do not reveal grading keys beyond what is needed for the review.`;

  const user = `Question title: ${input.questionTitle}

Prompt:
${input.questionPrompt}

Ideal answer:
${input.idealAnswer}

Explanation:
${input.explanation}

Student answer:
${input.studentAnswer}`;

  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      stream: false,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(
      `AI provider error (${res.status}): ${raw.slice(0, 400) || res.statusText}`,
    );
  }

  let data: {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new Error(`AI provider returned non-JSON: ${raw.slice(0, 400)}`);
  }

  const feedback = data.choices?.[0]?.message?.content?.trim();
  if (!feedback) {
    throw new Error("AI provider returned an empty completion.");
  }

  return {
    feedback,
    model: data.model ?? config.model,
  };
}
