import { SlashCommandBuilder } from "discord.js";
import { getOrCreateUser, getUserPenality } from "../database.js";
import { penalities } from "../functions/penalties/penalities.js";

export const name = "penalty";
export const aliases = ["penalidade", "penalidades", "penaltys", "penality"];

export const data = new SlashCommandBuilder()
  .setName("penalty")
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

  const penalty = getUserPenality(targetUser.id, guildId);

  if (!penalty) {
    return data.reply(`${displayName} não tem penalidades.`);
  }

  return data.reply(
    `Penalidade de ${displayName}: ${penalty}\n
    ${Object.values(penalities).find(p => p.nome === penalty)?.description || "Descrição não encontrada"}
    `

  );
}