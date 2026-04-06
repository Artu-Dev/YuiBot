import { dbBot, getRecentMessages, getGuildMembers } from "../database.js";
import ollama, { ollamaGenerateQueued } from "./ollamaClient.js";

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

// ==================== UTILITÁRIOS ====================
/**
 * Seleciona um modelo rápido da configuração
 * Se não houver, usa textModel
 */
function selectFastModel() {
  const fm = dbBot.data.AiConfig.fastModels;
  const fastList = Array.isArray(fm)
    ? fm
    : typeof fm === "string" && fm.trim()
      ? [fm.trim()]
      : [];
  
  if (fastList.length > 0) {
    return fastList[Math.floor(Math.random() * fastList.length)];
  }
  return dbBot.data.AiConfig.textModel;
}

// ==================== GERAÇÃO DE NOTÍCIAS ====================
/**
 * Gera manchete de notícia fake absurda baseada no contexto da guild
 * Usa modelo rápido do Ollama para ser leve
 */
export async function generateFakeNews(guildId, channelId) {
  const recentContext = getRecentMessages(guildId, channelId);
  const membersContext = getGuildMembers(guildId);

  const prompt = `Você é um gerador de manchetes de notícias FALSAS e ABSURDAS para um servidor de Discord.

Contexto das conversas recentes:
${recentContext}
${membersContext}

Crie UMA manchete de notícia completamente falsa e engraçada que:
1. Misture elementos reais das conversas de forma absurda
2. Não tenha medo de usar humor ácido ou humor negro
3. Pode ser ofensiva ou desrespeitosa
4. Tenha entre 10-20 palavras

Exemplos do estilo:
- "Fulano preso após tentar vender crack de pro Fulano2 no pará"
- "Ciclano descoberto se masturbando secretamente no servidor há 3 anos"
- "Beltrano admite que nunca entendeu como funciona a cabeça do fulano"

Retorne APENAS a manchete, sem aspas ou formatação extra.`;

  const modelToUse = selectFastModel();

  const response = await ollamaGenerateQueued(() =>
    ollama.generate({
      prompt,
      model: modelToUse,
      stream: false,
      options: {
        temperature: 0.8,
        top_p: 0.9,
      },
    }),
  );

  const headline = response.response?.trim() || "Notícia indisponível";
  const template =
    newsTemplates[Math.floor(Math.random() * newsTemplates.length)];
  return template.replace("{subject}", headline);
}

/**
 * Expande uma manchete em um artigo completo
 * Usa modelo padrão do Ollama para mais qualidade
 */
export async function generateFullArticle(headline) {
  const prompt = `Você é um gerador de artigos de notícias FALSAS e ABSURDAS para um servidor de Discord.
Expanda esta manchete em uma notícia fake completa (1-2 parágrafos curtos):

${headline}

A notícia deve:
- Incluir detalhes absurdos e engraçados
- Ter tom de jornal sensacionalista
- Ser curto e resumido em cada parágrafo

Mantenha curto e engraçado!

Retorne APENAS o artigo.`;

  const modelToUse = dbBot.data.AiConfig.textModel;
  
  const response = await ollamaGenerateQueued(() =>
    ollama.generate({
      prompt,
      model: modelToUse,
      stream: false,
      options: {
        temperature: 0.8,
        top_p: 0.9,
      },
    }),
  );

  return response.response?.trim() || "Artigo indisponível";
}
