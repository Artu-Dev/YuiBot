import { getOrCreateUser, getUserPenalities } from "../database.js";

export const name = "penality";

const formatPenaltyList = (list) =>
  list.length > 0
    ? list.map((pen, idx) => `• ${idx + 1}. ${pen}`).join("\n")
    : "Nenhuma penalidade encontrada.";

export async function run(client, message) {
  const guildId = message.guild.id;
  const targetUser = message.mentions.users.first() || message.author;
  const displayName = message.mentions.users.first()
    ? message.mentions.users.first().username
    : message.author.username;

  getOrCreateUser(targetUser.id, displayName, guildId);

  const penalities = getUserPenalities(targetUser.id, guildId);

  if (penalities.length === 0) {
    return message.reply(`${displayName} não tem penalidades.`);
  }

  return message.reply(
    `Penalidades de ${displayName}:\n${formatPenaltyList(penalities)}`
  );
}

export async function runInteraction(client, interaction) {
  const guildId = interaction.guildId;
  const targetUser = interaction.options.getUser("usuário") || interaction.options.getUser("usuario") || interaction.user;

  const displayName = targetUser.username;
  getOrCreateUser(targetUser.id, displayName, guildId);

  const penalities = getUserPenalities(targetUser.id, guildId);

  if (penalities.length === 0) {
    return interaction.reply({ content: `${displayName} não tem penalidades.`, ephemeral: true });
  }

  return interaction.reply({ content: `Penalidades de ${displayName}:\n${formatPenaltyList(penalities)}`, ephemeral: true });
}
