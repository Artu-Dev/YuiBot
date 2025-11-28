import Config from "../config.js";
import { intializeDbBot, dbBot } from "../database.js";
import { handleAchievements } from "../functions/achievements.js";
import { generateAiRes } from "../functions/generateRes.js";
import { limitChar } from "../functions/limitChar.js";
import { sayInCall } from "../functions/sayInCall.js";

const name = "messageCreate";
await intializeDbBot();

const execute = async (message, client) => {
  if (message.author.bot) return;
  if (!dbBot.data.channels.includes(message.channel.id)) return;

  const text = message.content;
  const randomInt = Math.floor(Math.random() * 10) + 1;
  const isMentioned = message.mentions.has(client.user);

  if (text.startsWith(Config.PREFIX)) {
    const args = text.slice(Config.PREFIX.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    const command = client.commands.get(cmdName);
    // const command = await client.commands.get(text.slice(Config.PREFIX.length).split(" ")[0]);
    if(command) {
      try {
        command.run(client, message);
        return;
      } catch (error) {
        console.error(error);
      }
    }
    return;
  }


  if ((typeof message.content === "string" && randomInt === 2) || isMentioned) {
    message.channel.sendTyping();
    const aiResponse = await generateAiRes(message)
    await message.reply(aiResponse);

    sayInCall(message, aiResponse);
  }


  handleAchievements(message);
  
  limitChar(message);
};

export { name, execute };
