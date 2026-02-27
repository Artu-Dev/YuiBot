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

export default ollama;
