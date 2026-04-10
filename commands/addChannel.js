import { SlashCommandBuilder } from "discord.js";
import { addChannel, getChannels } from "../database.js";

export const name = "add-channel";

export const data = new SlashCommandBuilder()
  .setName("add-channel")
  .setDescription("Adiciona o canal atual à lista de canais permitidos.");

export async function execute(client, data) {
  const guild_id = data.guildId;
  const channel_id = data.channelId;
  const channels = getChannels(guild_id);
  const isAdmin = data.isAdmin();

  if (!isAdmin) {
    return data.reply({ content: "❌ Apenas administradores podem usar este comando.", ephemeral: true });
  }


  if (!channels.includes(channel_id)) {
    addChannel(guild_id, channel_id);
    data.reply("Canal adicionado!");
  } else {
    data.reply("Este canal já está na lista!");
  }
}