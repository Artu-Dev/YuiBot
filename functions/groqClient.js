import Groq from "groq-sdk";
import { dbBot } from "../database.js";

export function hasGroqApiKey() {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

function getClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

const DEFAULT_GROQ_INVERT_MODEL = "llama-3.1-8b-instant";
const DEFAULT_GROQ_CHAT_MODEL = "gemini-3-flash-preview";

export function resolveGroqChatModel() {
  return (
    process.env.GROQ_CHAT_MODEL?.trim() ||
    DEFAULT_GROQ_CHAT_MODEL
  );
}

export function resolveGroqInvertModel() {
  return (
    process.env.GROQ_INVERT_MODEL?.trim() ||
    dbBot.data?.AiConfig?.groqInvertModel ||
    DEFAULT_GROQ_INVERT_MODEL
  );
}


export async function chatCompletion({
  system,
  user,
  model,
  maxTokens = 512,
  temperature = 0.85,
  topP = 0.92,
}) {
  if (!hasGroqApiKey()) {
    throw new Error("GROQ_API_KEY ausente");
  }

  const client = getClient();
  const maxRetries = 3;
  let lastErr;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const r = await client.chat.completions.create({
        model,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
      });
      const text = r.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("Resposta vazia do Groq");
      return text;
    } catch (e) {
      lastErr = e;
      const status = e?.status ?? e?.response?.status;
      if (status === 429 && attempt < maxRetries - 1) {
        await new Promise((res) => setTimeout(res, 1200 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }

  throw lastErr;
}
