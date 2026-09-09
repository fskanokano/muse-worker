import { describe, expect, it } from "vitest"
import worker from "../src/index"

const ENV = { PROXY_API_KEY: "test-key" }
const AUTH = { authorization: "Bearer test-key" }

function sseResponse(events: Array<Record<string, unknown>>): Response {
  const lines = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("")
  return new Response(lines + "data: [DONE]\n\n", {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  })
}

describe("worker entry (src/index.ts)", () => {
  it("routes /v1/chat/completions to the chat pipeline", async () => {
    globalThis.fetch = (async () =>
      sseResponse([
        { type: "response.output_text.delta", delta: "hi" },
        { type: "response.completed", response: {} },
      ])) as typeof fetch
    const res = await worker.fetch(
      new Request("https://proxy.example/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", ...AUTH },
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }], stream: false }),
      }),
      ENV,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { object: string }
    expect(body.object).toBe("chat.completion")
  })

  it("routes /v1/models to the static catalog", async () => {
    const res = await worker.fetch(new Request("https://proxy.example/v1/models", { headers: AUTH }), ENV)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { object: string; data: Array<{ id: string }> }
    expect(body.object).toBe("list")
    expect(body.data[0]!.id).toBe("muse-spark-1.3-contributor-free")
  })

  it("returns 404 for unknown paths", async () => {
    const res = await worker.fetch(new Request("https://proxy.example/v1/embeddings", { headers: AUTH }), ENV)
    expect(res.status).toBe(404)
  })

  it("enforces auth on both routes", async () => {
    const chat = await worker.fetch(
      new Request("https://proxy.example/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [] }),
      }),
      ENV,
    )
    expect(chat.status).toBe(401)
    const models = await worker.fetch(new Request("https://proxy.example/v1/models"), ENV)
    expect(models.status).toBe(401)
  })
})
