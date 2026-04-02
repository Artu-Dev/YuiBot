import { removeUserPenality, clearUserPenalities, getUserPenalities, getOrCreateUser } from "../database.js";

export const name = "remove-penality";

export async function run(client, message) {
  const guildId = message.guild.id;
  const rawText = message.content.trim();
  const prefix = rawText.startsWith("/") ? "/" : "";
  const withoutPrefix = prefix ? rawText.slice(1).trim() : rawText;
  const parts = withoutPrefix.split(/\s+/).slice(1);

  const targetUser = message.mentions.users.first() || message.author;
  getOrCreateUser(targetUser.id, targetUser.username, guildId);

  const existing = getUserPenalities(targetUser.id, guildId);
  if (existing.length === 0) {
    return message.reply(`${targetUser.username} não possui penalidades.`);
  }

  const penaltyArg = parts.filter((p) => !targetUser.id.includes(p) && !p.startsWith("<@") && !p.startsWith("@"))[0];

  if (!penaltyArg || penaltyArg.toLowerCase() === "all") {
    clearUserPenalities(targetUser.id, guildId);
    return message.reply(`Todas as penalidades de ${targetUser.username} foram removidas.`);
  }

  const removed = removeUserPenality(targetUser.id, guildId, penaltyArg);
  if (!removed) {
    return message.reply(
      `${targetUser.username} não possuía a penalidade '${penaltyArg}'.` 
    );
  }

  return message.reply(
    `Penalidade '${penaltyArg}' removida de ${targetUser.username}.` 
  );
}

export async function runInteraction(client, interaction) {
  const guildId = interaction.guildId;
  const targetUser = interaction.options.getUser("usuário") || interaction.options.getUser("usuario") || interaction.user;
  const penaltyArg = interaction.options.getString("penalidade");

  getOrCreateUser(targetUser.id, targetUser.username, guildId);

  const existing = getUserPenalities(targetUser.id, guildId);
  if (existing.length === 0) {
    return interaction.reply({ content: `${targetUser.username} não possui penalidades.`, ephemeral: true });
  }

  if (!penaltyArg || penaltyArg.toLowerCase() === "all") {
    clearUserPenalities(targetUser.id, guildId);
    return interaction.reply({ content: `Todas as penalidades de ${targetUser.username} foram removidas.`, ephemeral: true });
  }

  const normalizedPenalty = penaltyArg.trim().toLowerCase();
  const removed = removeUserPenality(targetUser.id, guildId, normalizedPenalty);

  if (!removed) {
    return interaction.reply({ content: `${targetUser.username} não possuía a penalidade '${normalizedPenalty}'.`, ephemeral: true });
  }

  return interaction.reply({ content: `Penalidade '${normalizedPenalty}' removida de ${targetUser.username}.`, ephemeral: true });
}

