import { Ollama } from "ollama";

const host = process.env.OLLAMA_HOST || "https://ollama.com";

const headers = {};
if (process.env.OLLAMA_API_KEY) {
  headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
}

const ollama = new Ollama({
  host,
  headers,
});

let ollamaQueue = Promise.resolve();

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function isRetryableOllamaError(err) {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  const code = err.code;
  if (code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ECONNREFUSED") {
    return true;
  }
  if (msg.includes("fetch failed")) return true;
  if (msg.includes("timed out")) return true;
  if (msg.includes("concurrent")) return true;
  if (msg.includes("too many concurrent")) return true;
  if (msg.includes("request slot")) return true;
  return false;
}

async function runWithRetries(run, maxAttempts = 4) {
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await run();
    } catch (e) {
      lastErr = e;
      if (!isRetryableOllamaError(e) || i === maxAttempts - 1) {
        throw e;
      }
      await sleep(700 * 2 ** i);
    }
  }
  throw lastErr;
}

/**
 * Uma requisição Ollama de cada vez + retries para rede / fila / concorrência.
 */
export function ollamaGenerateQueued(run) {
  const job = ollamaQueue.then(() => runWithRetries(run));
  ollamaQueue = job.catch(() => {});
  return job;
}

export default ollama;
