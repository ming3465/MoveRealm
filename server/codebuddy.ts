import { randomUUID } from "node:crypto";

interface Attachment {
  type: "image" | "file";
  url: string;
  urlType: "local-path";
}

interface CodeBuddyOptions {
  baseUrl?: string;
  password?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface RunEnvelope {
  data?: {
    runId?: string;
    status?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

// Current CodeBuddy vision/planning runs on the target M1 Pro commonly finish in
// 26-35 seconds. Keep one bounded deadline across submit, stream, and status,
// while leaving enough headroom for a valid local run to complete.
export const DEFAULT_CODEBUDDY_RUN_TIMEOUT_MS = 45_000;
// Browser and smoke deadlines budget for at most two structured attempts at
// this ceiling. Environment overrides may shorten a run, but never extend it.
export const MAX_CODEBUDDY_RUN_TIMEOUT_MS = 45_000;

export class CodeBuddyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodeBuddyError";
  }
}

function tryParseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function extractJsonValues(text: string): unknown[] {
  const trimmed = text.trim();
  const values: unknown[] = [];
  const seen = new Set<string>();

  const add = (candidate: string): boolean => {
    const normalized = candidate.trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    const parsed = tryParseJson(normalized);
    if (parsed !== undefined) {
      values.push(parsed);
      return true;
    }
    return false;
  };

  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (add(unfenced)) return values;

  let start = -1;
  let inString = false;
  let escaped = false;
  const closings: string[] = [];
  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{" || character === "[") {
      if (closings.length === 0) start = index;
      closings.push(character === "{" ? "}" : "]");
      continue;
    }
    if (character === "}" || character === "]") {
      if (closings.at(-1) !== character) {
        closings.length = 0;
        start = -1;
        continue;
      }
      closings.pop();
      if (closings.length === 0 && start >= 0) {
        add(trimmed.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return values;
}

function collectText(value: unknown, output: string[], depth = 0): void {
  if (depth > 8 || value == null) return;
  if (typeof value === "string") {
    output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, output, depth + 1));
    return;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (["text", "content", "markdown", "result", "output", "message", "delta", "data"].includes(key)) {
        collectText(child, output, depth + 1);
      }
    }
  }
}

function parseSseBlock(block: string): unknown | undefined {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data || data === "[DONE]") return undefined;
  return tryParseJson(data) ?? data;
}

export class CodeBuddyClient {
  private readonly baseUrl: string;
  private readonly password?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CodeBuddyOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://127.0.0.1:8080").replace(/\/$/, "");
    this.password = options.password;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_CODEBUDDY_RUN_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private headers(includeJson = false): Record<string, string> {
    return {
      ...(includeJson ? { "Content-Type": "application/json" } : {}),
      "X-CodeBuddy-Request": "1",
      ...(this.password ? { Authorization: `Bearer ${this.password}` } : {}),
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/v1/health`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(1_400),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async submit(
    prompt: string,
    attachments: Attachment[],
    signal: AbortSignal,
  ): Promise<string> {
    const messageId = `moverealm-${randomUUID()}`;
    const response = await this.fetchImpl(`${this.baseUrl}/api/v1/runs`, {
      method: "POST",
      headers: this.headers(true),
      signal,
      body: JSON.stringify({
        id: messageId,
        type: "message",
        version: "1.0",
        source: {
          platform: "moverealm",
          sender: { id: "movement-director", name: "MoveRealm" },
          conversation: { id: messageId, type: "direct" },
        },
        payload: { text: prompt, attachments },
        timeoutMs: this.timeoutMs,
      }),
    });

    const envelope = (await response.json().catch(() => ({}))) as RunEnvelope;
    if (!response.ok || !envelope.data?.runId) {
      const reason = envelope.error?.message ?? `HTTP ${response.status}`;
      throw new CodeBuddyError(`CodeBuddy rejected the run: ${reason}`);
    }
    return envelope.data.runId;
  }

  private async readRun(runId: string, signal: AbortSignal): Promise<unknown[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/v1/runs/${runId}/stream`, {
      headers: this.headers(),
      signal,
    });
    if (!response.ok || !response.body) {
      throw new CodeBuddyError(`CodeBuddy stream failed with HTTP ${response.status}.`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const events: unknown[] = [];

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const parsed = parseSseBlock(block);
        if (parsed !== undefined) events.push(parsed);
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const parsed = parseSseBlock(buffer);
      if (parsed !== undefined) events.push(parsed);
    }

    let statusResponse: Response | undefined;
    try {
      statusResponse = await this.fetchImpl(`${this.baseUrl}/api/v1/runs/${runId}`, {
        headers: this.headers(),
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw error;
    }
    if (statusResponse?.ok) {
      events.push(await statusResponse.json().catch(() => ({})));
    }
    return events;
  }

  async runStructured<T>(
    prompt: string,
    validate: (value: unknown) => T,
    attachments: Attachment[] = [],
  ): Promise<T> {
    // One signal covers submission, streaming, and the final status read. Creating a
    // new timeout for each phase lets one structured run exceed its advertised limit.
    const signal = AbortSignal.timeout(this.timeoutMs);
    try {
      const runId = await this.submit(prompt, attachments, signal);
      const events = await this.readRun(runId, signal);
      const textParts: string[] = [];
      events.forEach((event) => collectText(event, textParts));

      const candidates: unknown[] = [...events];
      for (const part of textParts) candidates.push(...extractJsonValues(part));
      candidates.push(...extractJsonValues(textParts.join("")));
      candidates.push(...extractJsonValues(textParts.join("\n")));

      let bestError: unknown;
      for (let index = candidates.length - 1; index >= 0; index -= 1) {
        try {
          return validate(candidates[index]);
        } catch (error) {
          bestError ??= error;
        }
      }
      const reason = bestError instanceof Error ? bestError.message : "No JSON object was returned.";
      throw new CodeBuddyError(`CodeBuddy output failed validation: ${reason}`);
    } catch (error) {
      if (signal.aborted) {
        throw new CodeBuddyError(`CodeBuddy run timed out after ${this.timeoutMs}ms.`);
      }
      throw error;
    }
  }
}

export type { Attachment };
