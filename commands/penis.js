import { SlashCommandBuilder } from "discord.js";

export const name = "penis";

export const data = new SlashCommandBuilder()
  .setName("penis")
  .setDescription("PENIS");

export async function execute(client, data) {
  return data.reply("penis");
}
