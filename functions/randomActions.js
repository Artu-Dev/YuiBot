import { log } from "../bot.js";
import { invertMessage } from "./ai/generateResponse.js";
import { getOrCreateWebhook, messageContainsDailyWord } from "./utils.js";
import { getRandomFilteredAvatar, getRandomOverlayAvatar } from "./canvasApi.js";

async function randomResend(message) {
  if (message.author.bot) return false;

  const original = message.content || "";
  if (original.length > 2000) return false;
  if (!original.trim()) return false;
  if (messageContainsDailyWord(original)) return false;

  const actions = ["shuffle", "aiInvert", "spoiler"];
  const choice = actions[Math.floor(Math.random() * actions.length)];

  let result = original;

  if (choice === "shuffle") {
    result = shuffleWords(original);
  } else if (choice === "aiInvert") {
    try {
      result = await invertMessage(original);
    } catch (e) {
      log(`❌ Erro no evento aleatório de inverter: ${e.message}`, "RandomAction", 31);
      return false;
    }
  } else if (choice === "spoiler") {
    result = original
      .split("")
      .map((c) => (c === " " ? " " : `||${c}||`))
      .join("");
  }

  try {
    const myWebHook = await getOrCreateWebhook(message.channel, message.author);
    
    let avatarURL = message.author.displayAvatarURL();
    if (choice === "aiInvert") {
      try {
        if (Math.random() < 0.6) {
          const filteredAvatarUrl = await getRandomOverlayAvatar(avatarURL);
          
          await myWebHook.send({
            content: result,
            username: message.member?.displayName || message.author.username,
            avatarURL: filteredAvatarUrl,
          });
          message.delete().catch(() => {});
          return true;

        }
      } catch (err) {
        log(`⚠️ Não foi possível aplicar filtro ao avatar, enviando sem filtro: ${err.message}`, "RandomAction", 33);
      }
    }
    
    await myWebHook.send({
      content: result,
      username: message.member?.displayName || message.author.username,
      avatarURL: avatarURL,
    });
    message.delete().catch(() => {});
    return true;
  } catch (err) {
    log(`❌ Falha ao reenviar mensagem aleatória: ${err.message}`, "RandomAction", 31);
    return false;
  }
}

function shuffleWords(str) {
  const words = str.split(/\s+/);
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  return words.join(" ");
}

export { randomResend };
