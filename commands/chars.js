import { SlashCommandBuilder } from "discord.js";
import { getOrCreateUser } from "../database.js";

export const name = "chars";

export const data = new SlashCommandBuilder()
  .setName("chars")
  .setDescription("Verifica os caracteres restantes de um usuário.")
  .addUserOption(option =>
    option.setName("usuário")
      .setDescription("O usuário para verificar (opcional, padrão é você mesmo)")
      .setRequired(false)
  );

function parseArgs(data) {
  if (data.fromInteraction) {
    return {
      mentionedUser: data.getUser("usuário"),
    };
  }

  return {
    mentionedUser: data.mentionedUser,
  };
}

export async function execute(client, data) {
  const { userId, guildId, displayName } = data;
  const { mentionedUser } = parseArgs(data);

  const targetDisplayName = mentionedUser?.username || displayName;
  const targetUserId = mentionedUser ? mentionedUser.id : userId;

  const userData = getOrCreateUser(targetUserId, targetDisplayName, guildId);

  if (!mentionedUser) {
    if (userData) {
      return await data.reply(
        `Você tem ${userData.charLeft} caracteres restantes!`
      );
    } else {
      return await data.reply(
        "Ainda não te registrei mano, manda uma mensagem aí (mas sem ser comando burro)."
      );
    }
  }

  if (userData) {
    return await data.reply(
      `O usuário **${targetDisplayName}** tem ${userData.charLeft} caracteres restantes.`
    );
  } else {
    return await data.reply(
      `O usuário **${targetDisplayName}** ainda não está registrado.`
    );
  }
}
