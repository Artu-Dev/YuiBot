import { intializeDbBot, dbBot } from "../database.js";
await intializeDbBot();

export const name = "remove-channel";
export async function run(client, message) {
  if (!dbBot.data.channels.includes(message.channel.id)) {
    dbBot.data.channels.splice(dbBot.data.channels.indexOf(channelId), 1);
    await dbBot.write();
    await message.reply("Canal Removido!");
  }
}
