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
import { generateAiRes } from "../functions/generateRes.js";
import { limitChar } from "../functions/limitChar.js";
import { sayInCall } from "../functions/sayInCall.js";
import { parseMessage, replaceMentions } from "../functions/utils.js";
import { randomResend } from "../functions/randomActions.js";

const name = "messageCreate";
await intializeDbBot();
const execute = async (message, client) => {
  if (message.author.bot && message.author.id != "974297735559806986") return;
  const { guildId, userId, channelId, displayName, text, mentions } = parseMessage(message, client);
  const prefix = dbBot.data.configs.prefix || "$";

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

  const isSlashCommand = text.startsWith("/");
  const isPrefixCommand = text.startsWith(prefix);

  if (isSlashCommand || isPrefixCommand) {
    const raw = isSlashCommand ? text.slice(1).trim() : text.slice(prefix.length).trim();
    const args = raw.split(/ +/);
    const cmdName = args.shift().toLowerCase();
    const command = client.commands.get(cmdName);

    if (command) {
      try {
        command.run(client, message);
      } catch (error) {
        console.error(error);
      }
    }
    return;
  }

  const channels = getChannels(guildId);
  if (!channels.includes(channelId)) return;

  const userData = getOrCreateUser(userId, displayName, guildId);

  limitChar(message, userData);
  saveMessageContext(channelId, guildId, displayName, await replaceMentions(message, text), userId);

  const resendchance = 0.05;
  const replyChance = 0.1; 
  if (Math.random() <= resendchance) {
    await randomResend(message);
  } else if ((mentions.isMentioningClient && Math.random() < 0.5) || (Math.random() < replyChance)) {
    await replyWithAi(message);
  }

  handleAchievements(message);
};

async function replyWithAi(message) {
  message.channel.sendTyping();
    let aiResponse = "";
    try {
      aiResponse = await generateAiRes(message);
      try {
        await message.reply(aiResponse);
      } catch (err) {
        await message.channel.send(aiResponse);
      }
    } catch (err) {
      console.error("Erro na geração/resposta AI:", err.message);
    }

    if (dbBot.data.configs.speakMessage && aiResponse) {
      sayInCall(message, aiResponse);
    }
}

export { name, execute };
