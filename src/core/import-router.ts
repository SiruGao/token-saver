import { isCodexRollout, normalizeCodexRollout } from "../adapters/codex";
import { analyzeSessions, parseTranscript as parseGeneric } from "./analyzer-v1";
import type { AgentSession } from "../types";

export { analyzeSessions };

export function parseTranscript(content: string, source: string): AgentSession {
  const codex = isCodexRollout(content, source);
  const prepared = codex ? normalizeCodexRollout(content) : content;
  const session = parseGeneric(prepared, source);
  if (codex && content.includes('"type":"turn_complete"')) {
    session.status = "success";
  }
  return session;
}
