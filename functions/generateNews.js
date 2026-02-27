import { dbBot, getRecentMessages, getGuildMembers } from "../database.js";
import ollama from "./ollamaClient.js";

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

export async function generateFakeNews(guildId, channelId) {
  const recentContext = getRecentMessages(guildId, channelId);
  const membersContext = getGuildMembers(guildId);

  const prompt = `Você é um gerador de manchetes de notícias FALSAS e ABSURDAS para um servidor de Discord.

Contexto das conversas recentes:
${recentContext}
${membersContext}

Crie UMA manchete de notícia completamente falsa e engraçada que:
1. Misture elementos reais das conversas de forma absurda
2. nao tenha medo de usar amor acido ou humor negro
3. pode ser ofensiva ou desrespeitosa
4. Tenha entre 10-20 palavras

Exemplos do estilo:
- "Fulano preso após tentar vender crack de pro Fulano2 no pará"
- "Ciclano descoberto se masturbando secretamente no servidor há 3 anos"
- "Beltrano admite que nunca entendeu como funciona o a cabeça do fulano"

Retorne APENAS a manchete, sem aspas ou formatação extra.`;

  let modelToUse = dbBot.data.AiConfig.textModel;
  if (Array.isArray(dbBot.data.AiConfig.fastModels) && dbBot.data.AiConfig.fastModels.length > 0) {
    const arr = dbBot.data.AiConfig.fastModels;
    modelToUse = arr[Math.floor(Math.random() * arr.length)];
  }
  const response = await ollama.generate({
    prompt: prompt,
    model: modelToUse,
    stream: false,
    options: {
      temperature: 0.8,
      top_p: 0.9,
    },
  });

  const headline = response.response.trim();
  const template =
    newsTemplates[Math.floor(Math.random() * newsTemplates.length)];
  return template.replace("{subject}", headline);
}

export async function generateFullArticle(headline) {
  const prompt = `Você é um gerador de arrigos de notícias FALSAS e ABSURDAS para um servidor de Discord.
  Expanda esta manchete em uma notícia fake completa (1-2 parágrafos curtos):

${headline}

A notícia deve:
- Incluir detalhes absurdos e engraçados e malditos
- Ter tom de jornal sensacionalista
- Ser curto e resumido em cada paragrafo

Mantenha curto e engraçado!

Retorne APENAS o artigo.
`;

  let modelToUse = dbBot.data.AiConfig.textModel;
  if (Array.isArray(dbBot.data.AiConfig.fastModels) && dbBot.data.AiConfig.fastModels.length > 0) {
    const arr = dbBot.data.AiConfig.fastModels;
    modelToUse = arr[Math.floor(Math.random() * arr.length)];
  }
  const response = await ollama.generate({
    prompt: prompt,
    model: modelToUse,
    stream: false,
    options: {
      temperature: 0.8,
      top_p: 0.9,
    },
  });

  return response.response.trim();
}
