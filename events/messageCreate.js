import {
  intializeDbBot,
  dbBot,
  getChannels,
  saveMessageContext,
  getOrCreateUser,
} from "../database.js";
import { handleAchievements } from "../functions/achievements.js";
import { generateAiRes } from "../functions/generateRes.js";
import { limitChar } from "../functions/limitChar.js";
import { sayInCall } from "../functions/sayInCall.js";
import { parseMessage, replaceMentions } from "../functions/utils.js";

const name = "messageCreate";
await intializeDbBot();
const prefix = dbBot.data.configs.prefix;

const execute = async (message, client) => {
  if (message.author.bot) return;
  const { guildId, userId, channelId, displayName, text, randomInt, isMentioned } = parseMessage(client, message);

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

  getOrCreateUser(userId, displayName, guildId);
  saveMessageContext(channelId, guildId, displayName, await replaceMentions(message, text));


  if ((typeof text === "string" && randomInt === 1) || isMentioned) {
    message.channel.sendTyping();
    const aiResponse = await generateAiRes(message);
    try {
      await message.reply(aiResponse);
    } catch {
      await message.channel.send(aiResponse);
    }

    if (dbBot.data.configs.speakMessage) {
      sayInCall(message, aiResponse);
    }
  }

  handleAchievements(message);

  limitChar(message);
};

export { name, execute };
