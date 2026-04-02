import { addUserPenality, getOrCreateUser } from "../database.js";
import { penalities } from "../functions/penalities.js";

export const name = "set-penality";

const EXISTING = penalities.map((p) => p.nome);

export async function run(client, message) {
  const guildId = message.guild.id;
  const author = message.author;

  const rawText = message.content.trim();
  const prefix = rawText.startsWith("/") ? "/" : "";
  const withoutPrefix = prefix ? rawText.slice(1).trim() : rawText;
  const parts = withoutPrefix.split(/\s+/).slice(1);

  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return message.reply("Uso: /set-penality @user <penality>\nPenalidades válidas: " + EXISTING.join(", "));
  }

  const hint = parts.filter((p) => !p.includes(targetUser.id));
  const penalty = hint.join(" ").trim().toLowerCase();

  if (!penalty) {
    return message.reply("Diga qual penalidade aplicar. Exemplo: /set-penality @user mute");
  }

  if (!EXISTING.includes(penalty)) {
    return message.reply(
      `Penalidade inválida. Valores possíveis: ${EXISTING.join(", ")}`
    );
  }

  getOrCreateUser(targetUser.id, targetUser.username, guildId);

  const added = addUserPenality(targetUser.id, guildId, penalty);
  if (!added) {
    return message.reply(`${targetUser.username} já tem a penalidade: ${penalty}.`);
  }

  return message.reply(`Penalidade '${penalty}' adicionada a ${targetUser.username}!`);
}

export async function runInteraction(client, interaction) {
  const guildId = interaction.guildId;
  const targetUser = interaction.options.getUser("usuário") || interaction.options.getUser("usuario");
  const penalty = interaction.options.getString("penalidade");

  if (!targetUser || !penalty) {
    return interaction.reply({
      content: `Uso: /set-penality @user <penalidade>\nPenalidades válidas: ${EXISTING.join(", ")}`,
      ephemeral: true,
    });
  }

  const normalizedPenalty = penalty.trim().toLowerCase();
  if (!EXISTING.includes(normalizedPenalty)) {
    return interaction.reply({
      content: `Penalidade inválida. Valores possíveis: ${EXISTING.join(", ")}`,
      ephemeral: true,
    });
  }

  getOrCreateUser(targetUser.id, targetUser.username, guildId);

  const added = addUserPenality(targetUser.id, guildId, normalizedPenalty);
  if (!added) {
    return interaction.reply({ content: `${targetUser.username} já tem a penalidade: ${normalizedPenalty}.`, ephemeral: true });
  }

  return interaction.reply({ content: `Penalidade '${normalizedPenalty}' adicionada a ${targetUser.username}!`, ephemeral: true });
}
