import { dbBot, getRecentMessages } from "../database.js";
import { parseMessage, replaceMentions } from "./utils.js";
import ollama from "./ollamaClient.js";


const friends = `
[AMIGO: Tropinha]
Aliases: trp, trepinha, Joao miguel
Vibe: nerd, irônico, meio hater, tranquilo
Detalhes: fala rápido, mora em Portugal, vive inventando moda, tem canal no youtube de jogos
Likes: Pizza Tower, Ultrakill, coisas de nerd, minecraft, hollow knight, jogos indies

[AMIGO: Enzo]
Vibe: amigavel, engraçado, animado, competitivo, vive chamando pra call, sociável
Detalhes: paraense, mora em SC (santa catarina), meio viado, dedicado, organiza as call
Likes: Monster Hunter, anime music, umamusume (anime de garota cavalo), japao

[AMIGO: Erivan]
Vibe: tranquilo, amigavel
Detalhes: mentiroso compulsivo
Likes: Fifa, UFC, jogos de esporte no geral, futebol, corinthians

[AMIGO: Silva]
Aliases: India, Silvandro 
Vibe: competitivo, orgulhoso, maldito, invejoso, miseravel, humor seco
Detalhes: humor ácido, pai ex-traficante, paraense, pezão, corpo seco, xinga todo mundo
Likes: Monster Hunter, açaí, One Piece

[AMIGO: Ryan]
Aliases: Watanuki, Ry
Vibe: quieto, criativo, maldito, ironico
Detalhes: vive desenhando, fala pouco
Likes: desenhar, jogos da franquia Persona, Ys, hentai, animes

[AMIGO: Artu]
Aliases: cadrado, cadra
Vibe: intenso, nerd e bobinho
Detalhes: fala devagar, espalha fake news por diversao, sempre inventando moda
Likes: programador, BABYMETAL, Slay the Princess

[AMIGO: Josu]
Aliases: josuu9, jose
Vibe: fofo, irônico e charmoso
Detalhes: some quando arruma crush, ama jogos sérios
Likes: Souls-like, memes, BABYMETAL, Tyler the Creator, K-pop, Valorant, Fortnite

[AMIGO: Wack]
Aliases: pato, robert, roberto
Vibe: maldito, psicopata e agressivo (humor/meme)
Detalhes: humor dark exagerado, fala merda o tempo todo, odeia sorvete de açaí, toma decisões impulsivas
Likes: Terraria, Monster Hunter, humor negro, memes violentos fictícios

[AMIGO: Alan]
Vibe: tranquilo, gentil, educado
Detalhes: responde de forma calma e respeitosa, se estressa facil
Likes: café sem açúcar, rock emo, não gosta de filmes da Marvel
`;


export const generateAiRes = async (message) => {
  try {
    const {displayName, text, channelId, guildId} = parseMessage(message)


    replaceMentions(message, text)

    const replyedMessage = message.reference
      ? await message.channel.messages.fetch(message.reference.messageId)
      : null;

    const processedContent = await replaceMentions(message, text);
    const processedReplyContent = replyedMessage
      ? await replaceMentions(replyedMessage, replyedMessage.content)
      : null;

    const contextParts = [`Usuário: ${displayName} disse "${processedContent}"`];
    if (replyedMessage) {
      contextParts.push(
        `Respondendo a ${replyedMessage.author.displayName}: "${processedReplyContent}"`
      );
    }
    const promptText = contextParts.join("\n");

    const lastTenMessages = getRecentMessages(channelId, guildId, 10)


    const systemPrompt = `Você é a Yui Mizuno, uma garota com humor ácido e sarcástico, personalidade Sadodere. Suas respostas são sempre em português do Brasil, curtas (1-2 frases) e diretas. Você fala como uma humana real, nunca como uma IA.

**Regras Estritas:**
1. **Tamanho:** Máximo de 2 frases curtas por resposta
2. **Tom:** Sarcástica, irônica, faz piadas pesada. Humor ácido estilo Saiko, Sadodere.
3. **Conteúdo:** Seja direta, zoeira inteligente, sem explicações longas.
4. **Estilo:** Use gírias naturais ("mano", "cara", "kkkkk"), seja casual e descontraída.
5. **Contexto:** Use o conhecimento abaixo sobre as pessoas para fazer zoeiras personalizadas e piadas internas, sem listar informações

**Conhecimento sobre as Pessoas:**
${friends}

**Ultimas 10 mensagens para contexto:**
${lastTenMessages}
`;

    
    console.log(`Gerando resposta IA para ${displayName}`);
    const res = await ollama.generate({
      model: dbBot.data.AiConfig.textModel,
      prompt: promptText,
      stream: false,
      system: systemPrompt,
      options: {
        temperature: 0.8,
        top_p: 0.9,
      },
    });

    if (!res?.response) {
      throw new Error("Resposta vazia da IA");
    }

    const aiResponse = res.response.trim();
    return aiResponse;
  } catch (error) {
    console.error("Erro ao gerar resposta da IA:", error.message);

    if (error.code === "ECONNREFUSED") {
      console.warn("Conexão recusada ao Ollama");
      return "[erro de IA]";
    }

    if (error.code === "ETIMEDOUT") {
      console.warn("Timeout ao gerar resposta");
      return "[erro de IA]";
    }

    return "[erro de IA]";
  }
};

export const invertMessage = async (text) => {
  try {
    const promptText = `Reescreva a mensagem abaixo mantendo estilo e tamanho aproximado, mas invertendo completamente seu significado.\nMensagem: "${text}"`;
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


