import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { dbBot } from "../database.js";
import { parseMessage } from "../functions/utils.js";

export const name = "palavra";

export const data = new SlashCommandBuilder()
  .setName("palavra")
  .setDescription("Mostra a palavra proibida do dia.");


export async function execute(client, data) {
  try {
    await dbBot.read();

    const dailyWord = dbBot.data?.configs.dailyWord || "(nenhuma)";
    const date = dbBot.data?.configs.dailyWordDate || "??";

    await data.reply(
      `A palavra proibida do dia (${date}): **${dailyWord}**`
    );
  } catch (error) {
    console.error("Erro ao buscar palavra do dia:", error);
    await data.reply("Ops, não consegui achar a palavra do dia.");
  }
}