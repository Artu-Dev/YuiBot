import { dbBot } from "../database.js";
import { parseMessage } from "../functions/utils.js";

export const name = "palavra";

export async function run(client, message) {
  try {
    await dbBot.read();

    const dailyWord = dbBot.data.configs.dailyWord || "(nenhuma)";
    const date = dbBot.data.configs.dailyWordDate || "??";

    await message.reply(
      `A palavra proibida do dia (${date}): **${dailyWord}**`
    );
  } catch (error) {
    console.error("Erro ao buscar palavra do dia:", error);
    await message.reply("Ops, não consegui recuperar a palavra do dia.");
  }
}
