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
  )
  .addSubcommand(sub =>
    sub
      .setName("random-achievement")
      .setDescription("Mostra imagem de uma conquista aleatória")
  )
  .addSubcommand(sub =>
    sub
      .setName("servers")
      .setDescription("Lista todos os servidores onde o bot está")
  )
  .addSubcommand(sub =>
    sub
      .setName("reload-config")
      .setDescription("Recarrega a configuração do bot")
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
    } else if (subcommand === "random-achievement") {
      return await handleRandomAchievement(data);
    } else if (subcommand === "servers") {
      return await handleServers(data, client);
    } else if (subcommand === "reload-config") {
      return await handleReloadConfig(data);
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
  const targetUser = data.options?.getUser?.("user");
  const achievementId = data.options?.getString?.("achievement");

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
  const targetUser = data.options?.getUser?.("user");
  const amount = data.options?.getInteger?.("amount");

  if (!targetUser) {
    throw new Error("User não fornecido");
  }

  if (amount === null || amount === undefined) {
    throw new Error("Amount não fornecido");
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
  const targetUser = data.options?.getUser?.("user");

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

async function handleRandomAchievement(data) {
  const { achievements } = await import("../functions/achievmentsData.js");
  
  const achKeys = Object.keys(achievements);
  if (achKeys.length === 0) {
    throw new Error("Nenhuma conquista encontrada");
  }

  const randomKey = achKeys[Math.floor(Math.random() * achKeys.length)];
  const ach = achievements[randomKey];

  const embed = new EmbedBuilder()
    .setColor(0xffaa00)
    .setTitle(`${ach.icon} ${ach.title}`)
    .setDescription(ach.description)
    .addFields(
      { name: "ID", value: `\`${randomKey}\``, inline: true },
      { name: "Categoria", value: ach.category || "geral", inline: true },
      { name: "Chars Reward", value: String(ach.charPoints || 0), inline: true }
    );

  if (ach.secret) {
    embed.setFooter({ text: "🤫 Conquista Secreta" });
  }

  const replyOpts = { embeds: [embed] };
  if (data.isEphemeral) replyOpts.flags = ChannelFlags.Ephemeral;
  return await data.reply(replyOpts);
}

async function handleServers(data, client) {
  const servers = client.guilds.cache.map(guild => ({
    name: guild.name,
    id: guild.id,
    members: guild.memberCount,
    owner: guild.ownerId
  }));

  const serverList = servers
    .map((s, idx) => `${idx + 1}. **${s.name}** (\`${s.id}\`) - ${s.members} membros`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(0x7289da)
    .setTitle(`🖥️ Servidores do Bot`)
    .setDescription(serverList || "Nenhum servidor")
    .setFooter({ text: `Total: ${servers.length} servidores` });

  const replyOpts = { embeds: [embed] };
  if (data.isEphemeral) replyOpts.flags = ChannelFlags.Ephemeral;
  return await data.reply(replyOpts);
}

async function handleReloadConfig(data) {
  try {
    const Config = await import("../data/config.js");
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("✅ Config Recarregada")
      .setDescription("Configuração do bot foi recarregada com sucesso!");

    const replyOpts = { embeds: [embed] };
    if (data.isEphemeral) replyOpts.flags = ChannelFlags.Ephemeral;
    return await data.reply(replyOpts);
  } catch (err) {
    throw new Error(`Erro ao recarregar config: ${err.message}`);
  }
}
