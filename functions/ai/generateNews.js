import { dbBot, getRecentMessages } from "../../database.js";
import { sample } from 'es-toolkit';
import ollama, { ollamaGenerateQueued } from "./clients/ollamaClient.js";

// ==================== TEMPLATES ====================
const newsTemplates = [
  "URGENTE: {subject}",
  "ÚLTIMA HORA: {subject}",
  "ESCÂNDALO: {subject}",
  "EXCLUSIVO: {subject}",
  "BOMBA: {subject}",
  "FUDEU: {subject}",
  "🚨 BREAKING NEWS: {subject}",
  "A CASA CAIU: {subject}",
];

// ==================== GERAÇÃO DE NOTÍCIAS ====================

export async function generateFakeNews(guildId, channelId) {
  const recentContext = getRecentMessages(guildId, channelId, 30);
  const modelToUse = dbBot.data?.AiConfig?.textModel || "qwen3.5:cloud";

  const system = `Você é um gerador de manchetes de notícias FALSAS e ABSURDAS para um servidor de Discord.

Crie UMA manchete de notícia completamente falsa e engraçada que:
1. Misture elementos reais das conversas de forma absurda
2. Não tenha medo de usar humor ácido ou humor negro
3. Pode ser ofensiva ou desrespeitosa
4. Tenha entre 10-20 palavras

Exemplos do estilo:
- "Fulano preso após tentar vender crack de pro Fulano2 no pará"
- "Ciclano descoberto goonando pra anime há 3 anos"
- "Beltrano admite que nunca entendeu como funciona a cabeça do fulano"

Retorne APENAS a manchete, sem aspas ou formatação extra.`;

  const userPrompt = `Contexto das conversas recentes:\n${recentContext}`;

  try {
    const response = await ollamaGenerateQueued(() => 
      ollama.generate({
        model: modelToUse,
        system: system,
        prompt: userPrompt,
        options: {
          temperature: 0.8,
          top_p: 0.9,
        },
      })
    );

    const headline = response.response;
    const template = sample(newsTemplates);
    return template.replace("{subject}", headline?.trim() || "Notícia indisponível");
  } catch (error) {
    console.error("Erro ao gerar Fake News com Ollama:", error);
    return sample(newsTemplates).replace("{subject}", "Notícia indisponível no momento");
  }
}

export async function generateFullArticle(headline) {
  const modelToUse = dbBot.data?.AiConfig?.textModel || "qwen3.5:cloud";

  const system = `Você é um gerador de artigos de notícias FALSAS e ABSURDAS para um servidor de Discord.
A notícia deve:
- Incluir detalhes absurdos e engraçados
- Ter tom de jornal sensacionalista
- Ser curto e resumido em cada parágrafo
Mantenha curto e engraçado!
Retorne APENAS o artigo.`;

  try {
    const response = await ollamaGenerateQueued(() => 
      ollama.generate({
        model: modelToUse,
        system: system,
        prompt: `Expanda esta manchete em uma notícia fake completa (1-2 parágrafos curtos):\n\n${headline}`,
        options: {
          temperature: 0.8,
        },
      })
    );

    const article = response.response;
    return article?.trim() || "Artigo indisponível";
  } catch (error) {
    console.error("Erro ao gerar Artigo Completo com Ollama:", error);
    return "Falha ao redigir o artigo no momento. O estagiário do jornal tropeçou nos cabos do servidor.";
  }
}