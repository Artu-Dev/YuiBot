import { SlashCommandBuilder } from "discord.js";
import { removeChannel, getChannels } from "../database.js";

export const name = "remove-channel";
export const aliases = ["remover-canal", "rm-channel", "rm-canal", "rm-ch"]; 

export const data = new SlashCommandBuilder()
  .setName("remove-channel")
  .setDescription("Remove o canal atual da lista de canais permitidos.");

export async function execute(client, data) {
  const guild_id = data.guildId;
  const channel_id = data.channelId;
  const channels = getChannels(guild_id);
  const isAdmin = data.isAdmin();

  if (!isAdmin) {
    return data.reply({ content: "❌ Apenas administradores podem usar este comando.", ephemeral: true });
  }

  if (channels.includes(channel_id)) {
    removeChannel(guild_id, channel_id);
    data.reply("Canal removido!");
  } else {
    data.reply("Este canal não está na lista de canais ativos.");
  }
}
