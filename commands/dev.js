import { SlashCommandBuilder, EmbedBuilder, ChannelFlags } from "discord.js";
import { unlockAchievement, getUser } from "../database.js";
import { log } from "../bot.js";

const OWNER_ID = "924279308900499457";

export const name = "dev";
export const aliases = ["d"];

export const data = new SlashCommandBuilder()
  .setName("dev")
  .setDescription("Comandos de desenvolvimento (apenas owner)")
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

function parseArgs(data) {
  if (data.fromInteraction) {
    const subcommand = data.options.getSubcommand();
    return {
      subcommand,
      targetUser: data.options.getUser("user"),
      achievementId: data.options.getString("achievement"),
      amount: data.options.getInteger("amount"),
    };
  }

  const args = data.content?.split(/\s+/).slice(1) ?? [];
  return {
    subcommand: args[0]?.toLowerCase(),
    args,
    targetUser: data.mentions?.users?.first(),
  };
}

export async function execute(client, data) {
  const { userId, guildId } = data;

  if (userId !== OWNER_ID) {
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("❌ Acesso Negado")
      .setDescription("Apenas o owner pode usar esses comandos!");

    const opts = { embeds: [embed] };
    if (data.isEphemeral) opts.flags = ChannelFlags.Ephemeral;
    return data.reply(opts);
  }

  const { subcommand, targetUser, achievementId, amount, args } = parseArgs(data);

  if (!subcommand) {
    return data.reply("❌ Use: `$dev <subcomando> [argumentos]`\nExemplo: `$dev chars @usuário 3000`");
  }

  try {
    switch (subcommand) {
      case "achievement":
        return await handleAchievement(data, guildId, targetUser, achievementId, args);

      case "chars":
        return await handleChars(data, guildId, targetUser, amount, args);

      case "shop-reset":
        return await handleShopReset(data, guildId);

      case "user-info":
        return await handleUserInfo(data, guildId, targetUser, args);

      case "random-achievement":
        return await handleRandomAchievement(data);

      case "servers":
        return await handleServers(data, client);

      case "reload-config":
        return await handleReloadConfig(data);

      default:
        return data.reply(`❌ Subcomando inválido: **${subcommand}**`);
    }
  } catch (error) {
    log(`❌ Erro em dev/${subcommand}: ${error.message}`, "Dev", 31);

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("❌ Erro")
      .setDescription(`\`\`\`js\n${error.message}\n\`\`\``);

    const opts = { embeds: [embed] };
    if (data.isEphemeral) opts.flags = ChannelFlags.Ephemeral;
    return data.reply(opts);
  }
}

// ====================== HANDLERS ======================

async function handleAchievement(data, guildId, targetUser, achievementId, args = []) {
  if (data.fromInteraction) {
    if (!targetUser || !achievementId) {
      throw new Error("Usuário e/ou ID da conquista não informados.");
    }
  } else {
    if (!targetUser && args[1]) {
      targetUser = await data.client.users.fetch(args[1]).catch(() => null);
    }
    achievementId = achievementId || args[2];

    if (!targetUser || !achievementId) {
      throw new Error("Uso: `$dev achievement @usuário <achievementID>`");
    }
  }

  const success = unlockAchievement(targetUser.id, guildId, achievementId);

  const embed = new EmbedBuilder()
    .setColor(success ? 0x00ff00 : 0xffaa00)
    .setTitle("🏆 Conquista")
    .setDescription(
      success
        ? `Conquista **${achievementId}** desbloqueada para **${targetUser.username}**!`
        : `Conquista **${achievementId}** já estava desbloqueada para **${targetUser.username}**.`
    );

  const opts = { embeds: [embed] };
  if (data.isEphemeral) opts.flags = ChannelFlags.Ephemeral;
  return data.reply(opts);
}

async function handleChars(data, guildId, targetUser, amount, args = []) {
  if (data.fromInteraction) {
    if (!targetUser || amount === null) {
      throw new Error("Usuário e/ou quantidade não informados.");
    }
  } else {
    if (!targetUser && args[1]) {
      targetUser = await data.client.users.fetch(args[1]).catch(() => null);
    }
    amount = amount || parseInt(args[2]);

    if (!targetUser || isNaN(amount) || amount < 0) {
      throw new Error("Uso: `$dev chars @usuário 3000`");
    }
  }

  const { db } = await import("../database.js");

  db.prepare("UPDATE users SET charLeft = ? WHERE id = ? AND guild_id = ?").run(
    amount,
    targetUser.id,
    guildId
  );

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("💰 Chars Atualizados")
    .setDescription(`Chars de **${targetUser.username}** definidos para **${amount}**.`);

  const opts = { embeds: [embed] };
  if (data.isEphemeral) opts.flags = ChannelFlags.Ephemeral;
  return data.reply(opts);
}

async function handleShopReset(data, guildId) {
  const { db } = await import("../database.js");
  db.prepare("DELETE FROM daily_shop WHERE guild_id = ?").run(guildId);

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("🏪 Loja Diária Resetada")
    .setDescription("A loja diária deste servidor foi resetada com sucesso!");

  const opts = { embeds: [embed] };
  if (data.isEphemeral) opts.flags = ChannelFlags.Ephemeral;
  return data.reply(opts);
}

async function handleUserInfo(data, guildId, targetUser, args = []) {
  if (!data.fromInteraction) {
    if (!targetUser && args[1]) {
      targetUser = await data.client.users.fetch(args[1]).catch(() => null);
    }
  }

  if (!targetUser) {
    throw new Error("Uso: `$dev user-info @usuário` ou `/dev user-info user:@usuário`");
  }

  const user = getUser(targetUser.id, guildId);
  if (!user) {
    throw new Error(`Usuário ${targetUser.username} não encontrado no banco de dados.`);
  }

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(`👤 ${targetUser.username}`)
    .addFields(
      { name: "ID", value: user.id, inline: true },
      { name: "Chars", value: String(user.charLeft || 0), inline: true },
      { name: "Mensagens", value: String(user.messages_sent || 0), inline: true },
      { name: "Penalidade", value: user.penality || "Nenhuma", inline: true },
      { name: "Conquistas", value: String(Object.keys(JSON.parse(user.achievements_unlocked || "{}")).length), inline: true }
    );

  const opts = { embeds: [embed] };
  if (data.isEphemeral) opts.flags = ChannelFlags.Ephemeral;
  return data.reply(opts);
}

async function handleRandomAchievement(data) {
  const { achievements } = await import("../functions/achievmentsData.js");
  const achKeys = Object.keys(achievements);

  if (achKeys.length === 0) throw new Error("Nenhuma conquista encontrada.");

  const randomKey = achKeys[Math.floor(Math.random() * achKeys.length)];
  const ach = achievements[randomKey];

  const embed = new EmbedBuilder()
    .setColor(0xffaa00)
    .setTitle(`${ach.icon || "🏆"} ${ach.title}`)
    .setDescription(ach.description)
    .addFields(
      { name: "ID", value: `\`${randomKey}\``, inline: true },
      { name: "Categoria", value: ach.category || "geral", inline: true },
      { name: "Chars Reward", value: String(ach.charPoints || 0), inline: true }
    );

  if (ach.secret) embed.setFooter({ text: "🤫 Conquista Secreta" });

  const opts = { embeds: [embed] };
  if (data.isEphemeral) opts.flags = ChannelFlags.Ephemeral;
  return data.reply(opts);
}

async function handleServers(data, client) {
  const servers = client.guilds.cache.map(guild => ({
    name: guild.name,
    id: guild.id,
    members: guild.memberCount,
    owner: guild.ownerId
  }));

  const serverList = servers
    .map((s, i) => `${i + 1}. **${s.name}** (\`${s.id}\`) - ${s.members} membros`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(0x7289da)
    .setTitle("🖥️ Servidores do Bot")
    .setDescription(serverList || "Nenhum servidor encontrado")
    .setFooter({ text: `Total: ${servers.length} servidores` });

  const opts = { embeds: [embed] };
  if (data.isEphemeral) opts.flags = ChannelFlags.Ephemeral;
  return data.reply(opts);
}

async function handleReloadConfig(data) {
  const Config = await import("../data/config.js");

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("✅ Config Recarregada")
    .setDescription("A configuração do bot foi recarregada com sucesso!");

  const opts = { embeds: [embed] };
  if (data.isEphemeral) opts.flags = ChannelFlags.Ephemeral;
  return data.reply(opts);
}