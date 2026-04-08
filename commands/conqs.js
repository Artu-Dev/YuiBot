import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { achievements } from "../functions/achievmentsData.js";
import { getOrCreateUser } from "../database.js";
import { resolveDisplayAvatarURL, discordDisplayLabel } from "../functions/utils.js";

export const name = "conqs";

export const data = new SlashCommandBuilder()
  .setName("conqs")
  .setDescription("Mostra as conquistas de um usuário.")
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
  const { userId, guildId, displayName, username, avatarURL } = data;
  const { mentionedUser } = parseArgs(data);

  const targetUserId = mentionedUser ? mentionedUser.id : userId;
  const targetUserDiscord = mentionedUser
    ? mentionedUser
    : {
        id: userId,
        username,
        displayName,
        displayAvatarURL: (opts) => avatarURL(opts),
      };

  const targetDisplayName = mentionedUser?.username || displayName;

  const userData = getOrCreateUser(targetUserId, targetDisplayName, guildId);

  function generateMessage(user, discordUser) {
    const unlocked = JSON.parse(user.achievements_unlocked || "{}");

    const achievementsPretty = Object.keys(unlocked).length
      ? Object.keys(unlocked)
        .map((key) => {
          const ach = achievements[key];
          return ach ? `ㅤ•ㅤ${ach.emoji} ${ach.name}` : `ㅤ•ㅤ🏆 ${key}`;
        })
        .join("\n")
      : "_Nenhuma ainda_";

    const icon = resolveDisplayAvatarURL(discordUser);
    const lbl = discordDisplayLabel(discordUser);
    const thumb = resolveDisplayAvatarURL(discordUser, { size: 256 });
    const eb = new EmbedBuilder().setColor("#8A2BE2");
    if (icon) {
      eb.setAuthor({
        name: `${lbl} — CONQUISTAS FODAS`,
        iconURL: icon,
      });
    } else {
      eb.setAuthor({ name: `${lbl} — CONQUISTAS FODAS` });
    }
    if (thumb) eb.setThumbnail(thumb);
    return eb
      .setDescription(
        `
🏆 **Conquistas desbloqueadas:**
${achievementsPretty}
      `
      )
      .setFooter({
        text: `ID: ${discordUser.id} • Dados atualizados`,
      });
  }

  const embed = generateMessage(userData, targetUserDiscord);
  return data.reply({ embeds: [embed] });
}