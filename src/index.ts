// Cloudflare Workers entry: single fetch handler dispatching both routes.
// Fetch Handler docs: incoming HTTP requests arrive as a standard Request;
// return a Response. Secrets arrive via the `env` parameter — never via
// `process.env` (Workers has no Node process env).
// Sources:
// - https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/
// - https://developers.cloudflare.com/workers/configuration/secrets/

import { handleChatRequest } from "../api/chat.js"
import { handleModelsRequest } from "../api/models.js"

export interface Env {
  PROXY_API_KEY?: string
}

function notFound(): Response {
  return new Response(
    JSON.stringify({
      error: { message: "not found", type: "invalid_request_error", code: "not_found", param: null },
    }),
    { status: 404, headers: { "content-type": "application/json" } },
  )
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === "/v1/chat/completions") {
      return handleChatRequest(request, env)
    }
    if (pathname === "/v1/models") {
      return handleModelsRequest(request, env)
    }
    return notFound()
  },
}
