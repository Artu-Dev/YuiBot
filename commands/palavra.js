import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { dbBot } from "../database.js";
import { log } from "../bot.js";

export const name = "palavra";
export const aliases = ["palavraproibida", "word", "pb", "proibida"];

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
    log(`❌ Erro ao buscar palavra do dia: ${error.message}`, "Palavra", 31);
    await data.reply("Ops, não consegui achar a palavra do dia.");
  }
}