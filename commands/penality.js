import { SlashCommandBuilder } from "discord.js";
import { getOrCreateUser, getUserPenality } from "../database.js";
import { penalities } from "../functions/penalties/penalities.js";

export const name = "penality";
export const aliases = ["penalidade", "penalidades", "penalitys"];

export const data = new SlashCommandBuilder()
  .setName("penality")
  .setDescription("Mostra as penalidades de um usuário.")
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
  const { userId, guildId, username } = data;
  const { mentionedUser } = parseArgs(data);

  const targetUser = mentionedUser || { id: userId, username };
  const displayName = targetUser.username;
  getOrCreateUser(targetUser.id, displayName, guildId);

  const penality = getUserPenality(targetUser.id, guildId);

  if (!penality) {
    return data.reply(`${displayName} não tem penalidades.`);
  }

  return data.reply(
    `Penalidade de ${displayName}: ${penality}\n
    ${penalities.filter(p => p.name === penality)}
    `

  );
}