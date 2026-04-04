import { invertMessage } from "./generateRes.js";
import { getOrCreateWebhook, messageContainsDailyWord } from "./utils.js";

async function randomResend(message) {
  if (message.author.bot) return false;

  const original = message.content || "";
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
      console.error("Erro no evento aleatório de inverter:", e.message);
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
    await myWebHook.send({
      content: result,
      username: message.member?.displayName || message.author.username,
      avatarURL: message.author.displayAvatarURL(),
    });
    message.delete().catch(() => {});
    return true;
  } catch (err) {
    console.error("Falha ao reenviar mensagem aleatória:", err.message);
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
