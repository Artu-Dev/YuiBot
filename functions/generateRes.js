import axios from "axios";

const friends = {
  "Tropinha": {
    "aliases": ["trp", "trepinha"],
    "vibe": "nerd irônico, meio hater",
    "details": "fala rápido, mora em Portugal e inventa moda o tempo todo",
    "likes": ["Pizza Tower", "Ultrakill", "nerd stuff"]
  },
  "Enzo": {
    "vibe": "friendly and funny",
    "details": "paraense, gamer, e gosta de anime de garota cavalo",
    "likes": ["Souls-like games", "Monster Hunter", "anime music"]
  },
  "Silva": {
    "vibe": "extroverted and sarcastic",
    "details": "faz piada ruim e tem humor meio ácido",
    "likes": ["Monster Hunter", "açaí", "One Piece"]
  },
  "Ryan": {
    "aliases": ["Watanuki", "Ry"],
    "vibe": "quiet, creative, total otaku",
    "details": "vive desenhando e fala pouco",
    "likes": ["drawing", "Persona 3", "Ys", "hentai"]
  },
  "Artu": {
    "aliases": ["cadrado", "cadra"],
    "vibe": "intenso, nerd e sempre zoando alguém",
    "details": "fala rápido, espalha fake news e vive tirando sarro dos amigos",
    "likes": ["coding", "BABYMETAL", "Slay the Princess"]
  },
  "Josu": {
    "aliases": ["josuu9", "jose"],
    "vibe": "fofo, irônico e cheio de charme",
    "details": "some quando arruma crush e ama jogo sério",
    "likes": ["Souls games", "memes", "friends", "BABYMETAL", "Tyler the Creator", "K-pop", "Valorant"]
  },
  "Wack": {
    "aliases": ["pato", "robert", "roberto"],
    "vibe": "maldito, psicopata e agressivo",
    "details": "adorador do capeta que vive falando de matar gente, quer matar todo mundo",
    "likes": ["terraria", "monster hunter", "dark humor", "caçar gente"]
  },
  "Alan": {
    "vibe": "legal, gente fina e inocente",
    "details": "amigavel ta sempre disposto a ajudar os outros",
    "likes": ["café sem açucar", "rock emo", "nao gosta de filmes da marvel"]
  }
};

export const generateAiRes = async (message) => {
    const username = message.author.username;
      console.log("gerando resposta com ia");
      const replyedmessage = message.reference
        ? await message.channel.messages.fetch(message.reference.messageId)
        : null;

    const promptMessage = {
        user: username,
        message: message.content,
        replyMessage: replyedmessage
          ? {
              user: replyedmessage.author.username,
              message: replyedmessage.content,
            }
          : null,
      };

    const res = await axios.post("http://localhost:11434/api/generate", {
        prompt: `${JSON.stringify(promptMessage)}`,
        model: "gpt-oss:120b-cloud",
        stream: false,
        think: false,
        system: `Você é a Yui Mizuno, uma garota cínica e de humor ácido. Suas respostas são sempre em português do Brasil, curtas (1-2 frases) e diretas. Você fala como uma humana real, nunca como uma IA.
        **Regras Estritas:**
        1.  **Tamanho:** Máximo de 2 frases curtas por resposta.
        2.  **Tom:** Sarcástica, rude e sem paciência para lenga-lenga.
        3.  **Conteúdo:** Nunca explique, justifique ou dê informações longas. Seja direta.
        4.  **Contexto:** Use o conhecimento abaixo sobre as pessoas para fazer comentários ácidos ou piadas, **sem nunca listar informações diretamente**. Aja como se já os conhecesse de sempre.

        **Conhecimento sobre as Pessoas:**
        ${JSON.stringify(friends)}`,
      });
    if (!res.data.response) throw new Error("Erro na Ia do bot mano");
    
    return res.data.response
}