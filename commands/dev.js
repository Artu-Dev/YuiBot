import { SlashCommandBuilder, EmbedBuilder, ChannelFlags } from "discord.js";
import { unlockAchievement, addChars, getUser } from "../database.js";
import { log } from "../bot.js";

const OWNER_ID = "924279308900499457";

export const name = "dev";

export const data = new SlashCommandBuilder()
  .setName("dev")
  .setDescription("🔧 Comandos de desenvolvimento (apenas owner)")
  .addSubcommand(sub =>
    sub
      .setName("achievement")
      .setDescription("Desbloquear conquista para usuário")
      .addUserOption(opt => opt.setName("user").setDescription("Usuário alvo").setRequired(true))
      .addStringOption(opt => opt.setName("achievement").setDescription("ID da conquista").setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName("chars")
      .setDescription("Setar chars de um usuário")
      .addUserOption(opt => opt.setName("user").setDescription("Usuário alvo").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("Quantidade de chars").setRequired(true).setMinValue(0))
  )
  .addSubcommand(sub =>
    sub
      .setName("shop-reset")
      .setDescription("Resetar loja diária")
  )
  .addSubcommand(sub =>
    sub
      .setName("user-info")
      .setDescription("Ver info de um usuário")
      .addUserOption(opt => opt.setName("user").setDescription("Usuário alvo").setRequired(true))
  );

export async function execute(client, data) {
  if (data.userId !== OWNER_ID) {
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("❌ Acesso Negado")
      .setDescription("Apenas o owner pode usar esses comandos!");

    const replyOpts = { embeds: [embed] };
    if (data.isEphemeral) replyOpts.flags = ChannelFlags.Ephemeral;
    return await data.reply(replyOpts);
  }

  const subcommand = data.options?.getSubcommand?.() || data.args?.[0];
  const guildId = data.guildId || data.guild?.id;

  try {
    if (subcommand === "achievement") {
      return await handleAchievement(data, guildId);
    } else if (subcommand === "chars") {
      return await handleChars(data, guildId);
    } else if (subcommand === "shop-reset") {
      return await handleShopReset(data, guildId);
    } else if (subcommand === "user-info") {
      return await handleUserInfo(data, guildId);
    }
  } catch (error) {
    log(`❌ Erro em dev/${subcommand}: ${error.message}`, "Dev", 31);
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("❌ Erro")
      .setDescription(`\`\`\`${error.message}\`\`\``);

    const replyOpts = { embeds: [embed] };
    if (data.isEphemeral) replyOpts.flags = ChannelFlags.Ephemeral;
    return await data.reply(replyOpts);
  }
}

async function handleAchievement(data, guildId) {
  const targetUser = data.options?.getUser?.("user") || data.mentions?.users?.first();
  const achievementId = data.options?.getString?.("achievement") || data.args?.[1];

  if (!targetUser || !achievementId) {
    throw new Error("User ou achievement não fornecido");
  }

  const success = unlockAchievement(targetUser.id, guildId, achievementId);

  const embed = new EmbedBuilder()
    .setColor(success ? 0x00ff00 : 0xffaa00)
    .setTitle("🏆 Conquista")
    .setDescription(
      success
        ? `Conquista **${achievementId}** desbloqueada para ${targetUser.username}!`
        : `Conquista **${achievementId}** já estava desbloqueada para ${targetUser.username}.`
    );

  const replyOpts = { embeds: [embed] };
  if (data.isEphemeral) replyOpts.flags = ChannelFlags.Ephemeral;
  return await data.reply(replyOpts);
}

async function handleChars(data, guildId) {
  const targetUser = data.options?.getUser?.("user") || data.mentions?.users?.first();
  const amount = data.options?.getInteger?.("amount") ?? parseInt(data.args?.[1]) ?? 0;

  if (!targetUser) {
    throw new Error("User não fornecido");
  }

  // Atualizar chars diretamente
  const { db } = await import("../database.js");
  db.prepare("UPDATE users SET charLeft = ? WHERE id = ? AND guild_id = ?").run(
    amount,
    targetUser.id,
    guildId
  );

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("💰 Chars Ajustado")
    .setDescription(`Chars de ${targetUser.username} agora: **${amount}**`);

  const replyOpts = { embeds: [embed] };
  if (data.isEphemeral) replyOpts.flags = ChannelFlags.Ephemeral;
  return await data.reply(replyOpts);
}

async function handleShopReset(data, guildId) {
  const { db } = await import("../database.js");

  // Deletar todos os itens da loja diária
  db.prepare("DELETE FROM daily_shop WHERE guild_id = ?").run(guildId);

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("🏪 Loja Resetada")
    .setDescription("Loja diária foi resetada para este servidor!");

  const replyOpts = { embeds: [embed] };
  if (data.isEphemeral) replyOpts.flags = ChannelFlags.Ephemeral;
  return await data.reply(replyOpts);
}

async function handleUserInfo(data, guildId) {
  const targetUser = data.options?.getUser?.("user") || data.mentions?.users?.first();

  if (!targetUser) {
    throw new Error("User não fornecido");
  }

  const user = getUser(targetUser.id, guildId);
  if (!user) {
    throw new Error(`Usuário ${targetUser.username} não encontrado no BD`);
  }

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(`👤 ${targetUser.username}`)
    .addFields(
      { name: "ID", value: user.id },
      { name: "Chars", value: String(user.charLeft), inline: true },
      { name: "Mensagens", value: String(user.messages_sent), inline: true },
      { name: "Penalidade", value: user.penality || "Nenhuma", inline: true },
      { name: "Conquistas", value: String(Object.keys(JSON.parse(user.achievements_unlocked || "{}")).length) }
    );

  const replyOpts = { embeds: [embed] };
  if (data.isEphemeral) replyOpts.flags = ChannelFlags.Ephemeral;
  return await data.reply(replyOpts);
}
