import { describe, expect, it } from "vitest";
import {
  CodeBuddyClient,
  DEFAULT_CODEBUDDY_RUN_TIMEOUT_MS,
  extractJsonValues,
} from "../server/codebuddy.js";

function rejectOnAbort(signal: AbortSignal | null | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    if (!signal) {
      reject(new Error("missing abort signal"));
      return;
    }
    const onAbort = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
}

describe("CodeBuddy structured response extraction", () => {
  it("extracts strict JSON from an SSE text fragment or markdown fence", () => {
    const values = extractJsonValues('Here is the result:\n```json\n{"spaceClass":"tight","confidence":0.8}\n```');
    expect(values).toContainEqual({ spaceClass: "tight", confidence: 0.8 });
  });

  it("does not mistake braces inside strings for object boundaries", () => {
    const values = extractJsonValues('trace {not json} then {"summary":"keep { this } literal","ok":true}');
    expect(values).toContainEqual({ summary: "keep { this } literal", ok: true });
  });

  it("returns a complete root object without treating nested arrays as competing responses", () => {
    const values = extractJsonValues(
      '```json\n{"nextRound":{"accent":"lavender"},"adjustments":["tempo"]}\n```',
    );
    expect(values).toEqual([
      { nextRound: { accent: "lavender" }, adjustments: ["tempo"] },
    ]);
  });

  it("reads structured output from the live API's content.markdown SSE envelope", async () => {
    const signals: AbortSignal[] = [];
    const responses = [
      new Response(JSON.stringify({ data: { runId: "run-1", status: "accepted" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
      new Response(
        'event: message\ndata: {"status":"completed","content":{"markdown":"```json\\n{\\"ok\\":true}\\n```"}}\n\nevent: done\ndata: {}\n\n',
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      ),
      new Response(JSON.stringify({ data: { status: "completed" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ];
    const client = new CodeBuddyClient({
      fetchImpl: async (_input, init) => {
        if (init?.signal) signals.push(init.signal);
        return responses.shift() ?? new Response(null, { status: 500 });
      },
    });
    const result = await client.runStructured("return JSON", (value) => {
      if (typeof value === "object" && value !== null && "ok" in value && value.ok === true) {
        return value as { ok: true };
      }
      throw new Error("invalid");
    });
    expect(result).toEqual({ ok: true });
    expect(signals).toHaveLength(3);
    expect(new Set(signals).size).toBe(1);
  });

  it("advertises the measured M1-safe default deadline to CodeBuddy", async () => {
    let submittedBody: { timeoutMs?: number } | undefined;
    const responses = [
      new Response(JSON.stringify({ data: { runId: "run-default-timeout" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
      new Response(
        'event: message\ndata: {"content":{"markdown":"{\\"ok\\":true}"}}\n\n',
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      ),
      new Response(JSON.stringify({ data: { status: "completed" } }), { status: 200 }),
    ];
    const client = new CodeBuddyClient({
      fetchImpl: async (_input, init) => {
        if (init?.body) submittedBody = JSON.parse(String(init.body)) as { timeoutMs?: number };
        return responses.shift() ?? new Response(null, { status: 500 });
      },
    });

    await client.runStructured("return JSON", (value) => value);

    expect(DEFAULT_CODEBUDDY_RUN_TIMEOUT_MS).toBe(45_000);
    expect(submittedBody?.timeoutMs).toBe(DEFAULT_CODEBUDDY_RUN_TIMEOUT_MS);
  });

  it("times out a hanging run submission within the structured-run deadline", async () => {
    const client = new CodeBuddyClient({
      timeoutMs: 20,
      fetchImpl: async (_input, init) => rejectOnAbort(init?.signal),
    });

    await expect(client.runStructured("return JSON", (value) => value)).rejects.toThrow(
      /timed out after 20ms/i,
    );
  });

  it("uses one overall deadline while an accepted run's SSE body hangs", async () => {
    const signals: AbortSignal[] = [];
    let call = 0;
    const client = new CodeBuddyClient({
      timeoutMs: 25,
      fetchImpl: async (_input, init) => {
        if (init?.signal) signals.push(init.signal);
        call += 1;
        if (call === 1) {
          return new Response(JSON.stringify({ data: { runId: "run-hanging" } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(
          new ReadableStream({
            start(controller) {
              const signal = init?.signal;
              const onAbort = () =>
                controller.error(signal?.reason ?? new DOMException("Aborted", "AbortError"));
              if (signal?.aborted) onAbort();
              else signal?.addEventListener("abort", onAbort, { once: true });
            },
          }),
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        );
      },
    });

    await expect(client.runStructured("return JSON", (value) => value)).rejects.toThrow(
      /timed out after 25ms/i,
    );
    expect(signals).toHaveLength(2);
    expect(signals[1]).toBe(signals[0]);
  });
});
