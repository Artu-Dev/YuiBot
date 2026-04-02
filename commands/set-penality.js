import { addUserPenality, getOrCreateUser } from "../database.js";

export const name = "set-penality";

const EXISTING = ["mute", "silêncio", "suspensão", "advertência", "sleep"];

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
