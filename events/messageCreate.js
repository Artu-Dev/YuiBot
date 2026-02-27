import {
  intializeDbBot,
  dbBot,
  getChannels,
  saveMessageContext,
  getOrCreateUser,
  getGuildUsers,
  addChars,
} from "../database.js";
import { handleAchievements } from "../functions/achievements.js";
import { generateAiRes, invertMessage } from "../functions/generateRes.js";
import { limitChar } from "../functions/limitChar.js";
import { sayInCall } from "../functions/sayInCall.js";
import { parseMessage, replaceMentions, getOrCreateWebhook } from "../functions/utils.js";

const name = "messageCreate";
await intializeDbBot();
const prefix = dbBot.data.configs.prefix;

const execute = async (message, client) => {
  if (message.author.bot) return;
  const { guildId, userId, channelId, displayName, text, randomInt, mentions } = parseMessage(message, client);

  const now = new Date();
  const monthYearNow = `${now.getMonth() + 1}/${now.getFullYear()}`;

  if (dbBot.data.lastReset !== monthYearNow) {
      console.log("--- NOVO MÊS DETECTADO: INICIANDO RESET GERAL ---");

      const users = getGuildUsers(guildId);
      for (const u of users) {
          addChars(u.id ,guildId, 2000);
      }

      dbBot.data.lastReset = monthYearNow;
      dbBot.write();

      console.log(`--- RESET CONCLUÍDO PARA O MÊS ${monthYearNow} ---`);
  }

  if (text.startsWith(prefix)) {
    const args = text.slice(prefix.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    const command = client.commands.get(cmdName);

    if (command) {
      try {
        command.run(client, message);
        return;
      } catch (error) {
        console.error(error);
      }
    }
  }

  const channels = getChannels(guildId);
  if (!channels.includes(channelId)) return;

  const userData = getOrCreateUser(userId, displayName, guildId);

  limitChar(message, userData);
  saveMessageContext(channelId, guildId, displayName, await replaceMentions(message, text), userId);

  maybeRandomResend(message);

  if ((typeof text === "string" && randomInt === 1) || mentions.isMentioningClient && Math.random() < 0.5) {
    message.channel.sendTyping();
    let aiResponse = "";
    try {
      aiResponse = await generateAiRes(message);
      try {
        await message.reply(aiResponse);
      } catch {
        await message.channel.send(aiResponse);
      }
    } catch (err) {
      console.error("Erro na geração/resposta AI:", err.message);
    }

    if (dbBot.data.configs.speakMessage && aiResponse) {
      sayInCall(message, aiResponse);
    }
  }

  handleAchievements(message);
};

async function maybeRandomResend(message) {
  if (message.author.bot) return;
  const chance = 0.005;
  if (Math.random() <= 0.5) return;
  const original = message.content || "";
  if (!original.trim()) return;

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
  } catch (err) {
    console.error("Falha ao reenviar mensagem aleatória:", err.message);
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

export { name, execute };
