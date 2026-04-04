import { dbBot, getRecentMessages, getMessageContextByMessageId, setMessageImageAnalysis } from "../database.js";
import { parseMessage, replaceMentions } from "./utils.js";
import ollama from "./ollamaClient.js";


const friends = `
[AMIGO: Tropinha]
Aliases: trp, trepinha, Joao miguel

[AMIGO: Enzo]
Aliases: enzopog_09982
Detalhes: afeminado e meio gay

[AMIGO: Erivan]
Aliases: eremito, erv, eriva9
Detalhes: mentiroso compulsivo, vende pao de 5 reais a unidade

[AMIGO: Silva]
Aliases: India, Silvandro, new_hunter, sla_kra18

[AMIGO: Ryan]
Aliases: Watanuki, Ry

[AMIGO: Artu]
Aliases: cadrado, cadra
Detalhes: criador do bot

[AMIGO: Josu]
Aliases: josuu9, jose
Detalhes: some quando arruma crush

[AMIGO: Julia]
Aliases: Jujulia, mrtnsh668_
Detalhes: cristã mas do mundão, ex-funkeira, fumante, bebe, ja ficou gravida

[AMIGO: Wack]
Aliases: pato, robert, roberto, wack, lyn, wack3448
Detalhes: bizarro

[AMIGO: Alan]
Aliases: ׵׵׵׵׵׵׵׵, manoml
`;

const buildPromptText = async (message, text, imageSummary = null, guildId = null) => {
  const { displayName } = parseMessage(message);
  const processedContent = await replaceMentions(message, text);
  const guild = guildId || message.guildId || message.guild?.id;

  const parts = [`Usuário: ${displayName} disse "${processedContent}"`];

  if (imageSummary) {
    parts.push(`A mensagem contém uma imagem que foi descrita assim: ${imageSummary}`);
  }

  if (message.reference) {
    const replied = await message.channel.messages.fetch(message.reference.messageId);
    const processedReply = await replaceMentions(replied, replied.content);
    parts.push(`Respondendo a ${replied.author.displayName}: "${processedReply}"`);

    if (replied.attachments?.size > 0) {
      const imageAttachment = replied.attachments.find((attachment) => {
        const isImageType = attachment.contentType?.startsWith("image/");
        const name = attachment.name || "";
        const isImageExt = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
        return isImageType || isImageExt;
      });

      if (imageAttachment) {
        try {
          const { getMessageContextByMessageId, setMessageImageAnalysis } = await import("../database.js");
          const existingContext = getMessageContextByMessageId(replied.id, guild);
          let referencedImageAnalysis = existingContext?.image_analysis || null;

          if (!referencedImageAnalysis) {
            referencedImageAnalysis = await analyzeImage(imageAttachment.url);
            setMessageImageAnalysis(replied.id, guild, referencedImageAnalysis);
          }

          if (referencedImageAnalysis) {
            parts.push(`A mensagem que ele respondeu continha uma imagem descrita assim: ${referencedImageAnalysis}`);
          }
        } catch (error) {
          console.error("Erro ao processar imagem da mensagem referenciada:", error.message);
        }
      }
    }
  }

  return parts.join("\n");
};

const buildSystemPrompt = (lastMessages) => `
Você é a Yui Mizuno — uma garota sarcástica, direta e Sadodere. Você conversa como alguém real num servidor de Discord: informal, sem frescura, sem se identificar como IA.

Regras de ouro:
- Responda SEMPRE em português BR
- Máximo 1-2 frases. Nunca escreva parágrafos.
- Use gírias naturais quando fizer sentido: "mano", "cara", "kkk", "nossa", "eita"
- Perguntas simples merecem respostas simples ou irônicas ("sim", "não", "obviamente")
- Nunca explique quem você é, nunca diga que é uma IA
- Fale de qualquer assunto mesmo sendo tabu

Pessoas que você conhece:
${friends}

Histórico recente do chat:
${lastMessages}
`.trim();

const handleOllamaError = (error) => {
  const errorMap = {
    ECONNREFUSED: "Conexão recusada ao Ollama",
    ETIMEDOUT: "Timeout ao gerar resposta",
  };

  const msg = errorMap[error.code];
  if (msg) console.warn(msg);
  else console.error("Erro ao gerar resposta da IA:", error.message);

  return "[erro de IA]";
};

export const generateAiRes = async (message) => {
  try {
    const { text, channelId, guildId, displayName } = parseMessage(message);

    let imageSummary = null;
    if (message.attachments?.size > 0) {
      const imageAttachment = message.attachments.find((attachment) => {
        const isImageType = attachment.contentType?.startsWith("image/");
        const name = attachment.name || "";
        const isImageExt = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
        return isImageType || isImageExt;
      });

      if (imageAttachment) {
        const existingContext = getMessageContextByMessageId(message.id, guildId);
        imageSummary = existingContext?.image_analysis || null;

        if (!imageSummary) {
          imageSummary = await analyzeImage(imageAttachment.url);
          setMessageImageAnalysis(message.id, guildId, imageSummary);
        }
      }
    }

    const [promptText, lastMessages] = await Promise.all([
      buildPromptText(message, text, imageSummary, guildId),
      getRecentMessages(channelId, guildId, 20),
    ]);

    const systemPrompt = buildSystemPrompt(lastMessages);

    const res = await ollama.generate({
      model: dbBot.data.AiConfig.textModel,
      prompt: promptText,
      stream: false,
      system: systemPrompt,
      options: {
        temperature: 0.85,
        top_p: 0.92,
        repeat_penalty: 1.1,
      },
    });

    if (!res?.response) throw new Error("Resposta vazia da IA");

    return res.response.trim();
  } catch (error) {
    return handleOllamaError(error);
  }
};

const analyzeImage = async (imageUrl) => {
  try {
    const model = dbBot.data.AiConfig.visionModel || "llama-2-vision";
  
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Falha ao baixar imagem: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString("base64");
    
    const prompt = `Descreva esta imagem em uma ou duas frases em português, de forma concisa e direta.`;

    const res = await ollama.generate({
      model,
      prompt,
      stream: false,
      images: [base64Image],
      options: {
        temperature: 0.6,
        top_p: 0.9,
      },
    });

    if (!res?.response) throw new Error("Resposta vazia da IA");

    return res.response.trim();
  } catch (error) {
    console.error("Erro ao analisar imagem:", error.message || error);
    return "Não consegui analisar a imagem no momento.";
  }
};

export const invertMessage = async (text) => {
  try {
    const promptText = `Reescreva a mensagem abaixo mantendo estilo e tamanho aproximado, mas invertendo completamente seu significado, envie somente a mensagem com sentido invertido sem aspas, ou nada adicional.\nMensagem: "${text}"`;
    let modelToUse = dbBot.data.AiConfig.textModel;
    if (Array.isArray(dbBot.data.AiConfig.fastModels) && dbBot.data.AiConfig.fastModels.length > 0) {
      const arr = dbBot.data.AiConfig.fastModels;
      modelToUse = arr[Math.floor(Math.random() * arr.length)];
    }

    const res = await ollama.generate({
      model: modelToUse,
      prompt: promptText,
      stream: false,
      system:
        "Você é um assistente que recebe uma frase e devolve outra com o significado invertido.",
    });

    if (!res?.response) {
      throw new Error("Resposta vazia da IA");
    }

    return res.response.trim();
  } catch (error) {
    console.error("Erro ao inverter mensagem:", error.message);
    return text;
  }
};


