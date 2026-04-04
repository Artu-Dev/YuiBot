import { SlashCommandBuilder } from "discord.js";
import {
  removeUserPenality,
  clearUserPenalities,
  getUserPenalities,
  getOrCreateUser,
  getBotPrefix,
} from "../database.js";

export const name = "remove-penality";

export const data = new SlashCommandBuilder()
  .setName("remove-penality")
  .setDescription("Remove uma penalidade de um usuário.")
  .addUserOption(option =>
    option.setName("usuário")
      .setDescription("O usuário para remover a penalidade (opcional, padrão é você mesmo)")
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName("penalidade")
      .setDescription("A penalidade a remover (ou 'all' para remover todas)")
      .setRequired(false)
  );

function parseArgs(data) {
  if (data.fromInteraction) {
    return {
      targetUser: data.getUser("usuário"),
      penaltyArg: data.getString("penalidade"),
    };
  }

  const args = data.args ?? [];
  const textArgs = args.filter((p) => !/^<@!?\d+>$/.test(String(p)));
  const penaltyArg = textArgs.length ? textArgs.join(" ").trim() : null;

  return {
    targetUser: data.mentionedUser,
    penaltyArg: penaltyArg || null,
  };
}

export async function execute(client, data) {
  const { userId, username, guildId } = data;
  const { targetUser, penaltyArg } = parseArgs(data);

  const finalTargetUser = targetUser || { id: userId, username };
  const finalPenaltyArg = penaltyArg;

  getOrCreateUser(finalTargetUser.id, finalTargetUser.username, guildId);

  const existing = getUserPenalities(finalTargetUser.id, guildId);
  if (existing.length === 0) {
    return data.reply(`${finalTargetUser.username} não possui penalidades.`);
  }

  if (!finalPenaltyArg) {
    const p = getBotPrefix();
    return data.reply(
      `Informe a penalidade a remover ou **all** para limpar todas.\nEx.: \`${p}remove-penality @user spam\` ou \`${p}remove-penality @user all\`.`
    );
  }

  if (finalPenaltyArg.toLowerCase() === "all") {
    clearUserPenalities(finalTargetUser.id, guildId);
    return data.reply(`Todas as penalidades de ${finalTargetUser.username} foram removidas.`);
  }

  const normalizedPenalty = finalPenaltyArg.trim().toLowerCase();
  const removed = removeUserPenality(finalTargetUser.id, guildId, normalizedPenalty);

  if (!removed) {
    return data.reply(
      `${finalTargetUser.username} não possuía a penalidade '${normalizedPenalty}'.`
    );
  }

  return data.reply(
    `Penalidade '${normalizedPenalty}' removida de ${finalTargetUser.username}.`
  );
}
