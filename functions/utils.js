import { dbBot } from "../database.js";

export function getRandomTime(minSeconds, maxSeconds) {
  const min = minSeconds * 1000;
  const max = maxSeconds * 1000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * @typedef {Object} CommandContext
 * @property {string}   userId
 * @property {string}   guildId
 * @property {string}   channelId
 * @property {string}   username
 * @property {string}   displayName
 * @property {Function} avatarURL
 * @property {boolean}  isBot
 * @property {boolean}  isEphemeral
 * @property {import('discord.js').User|null} mentionedUser
 * @property {Function} reply
 * @property {Function} followUp
 * @property {Function|null} editReply
 * @property {Function|null} deferReply
 * @property {boolean}      fromInteraction — true só para slash (use para parse de opções vs args)
 * @property {string}      content — texto bruto da mensagem (prefixo)
 */

/**
 * Constrói o contexto a partir de uma mensagem de prefixo.
 * @param {import('discord.js').Message} message
 * @returns {CommandContext}
 */

export function contextFromMessage(message) {
  return {
    userId: message.author.id,
    guildId: message.guild.id,
    channelId: message.channel.id,
    username: message.author.username,
    displayName: message.member?.displayName ?? message.author.username,
    avatarURL: (opts) => message.author.displayAvatarURL(opts),
    isBot: message.author.bot,
    isEphemeral: false,
    mentionedUser: message.mentions.users.first() ?? null,

    reply: (content) => message.reply(normalize(content)),
    followUp: (content) => message.channel.send(normalize(content)),
    editReply: null,
    deferReply: null,
    fromInteraction: false,
    content: message.content,
    args:          message.content.trim().split(/ +/).slice(1),
    getSubcommand: () => null,
    getString:     () => null,
    getUser:       () => null,
    getInteger:    () => null,
    voiceChannel: message.member?.voice?.channel ?? null,
  };
}

/**
 * Constrói o contexto a partir de uma slash interaction.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @returns {CommandContext}
 */
export function contextFromInteraction(interaction) {
  const user = interaction.user ?? interaction.member?.user;
  if (!user) throw new Error("Usuário não encontrado na interação.");

  return {
    userId: user.id,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    username: user.username,
    displayName:
      interaction.member?.displayName ?? user.displayName ?? user.username,
    avatarURL: (opts) => user.displayAvatarURL(opts),
    isBot: user.bot,
    isEphemeral: true,
    mentionedUser: interaction.options.getUser("usuário") ?? null,

    reply: (content) =>
      interaction.replied || interaction.deferred
        ? interaction.followUp(normalize(content))
        : interaction.reply(normalize(content)),
    followUp: (content) => interaction.followUp(normalize(content)),
    editReply: (content) => interaction.editReply(normalize(content)),
    deferReply: (opts) => interaction.deferReply(opts),
    fromInteraction: true,
    getSubcommand: () => interaction.options.getSubcommand(false) ?? null,
    getString: (name) => interaction.options.getString(name) ?? null,
    getUser: (name) => interaction.options.getUser(name) ?? null,
    getInteger: (name) => interaction.options.getInteger(name) ?? null,
    voiceChannel: interaction.member?.voice?.channel ?? null,
  };
}

/** Garante que strings viram { content } e objetos passam direto. */
function normalize(content) {
  return typeof content === "string" ? { content } : content;
}

/** URL do avatar para embeds (User, Member ou objeto com displayAvatarURL). */
export function resolveDisplayAvatarURL(userLike, options) {
  if (!userLike || typeof userLike.displayAvatarURL !== "function") return null;
  try {
    const url = userLike.displayAvatarURL(options);
    return typeof url === "string" && url.length > 0 ? url : null;
  } catch {
    return null;
  }
}

/** Fallback quando só existe data.avatarURL (contexto de comando). */
export function resolveAvatarFromContext(data, options) {
  if (data?.avatarURL && typeof data.avatarURL === "function") {
    try {
      const url = data.avatarURL(options);
      return typeof url === "string" && url.length > 0 ? url : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function discordDisplayLabel(userLike) {
  if (!userLike) return "?";
  return (
    userLike.displayName ??
    userLike.globalName ??
    userLike.username ??
    "?"
  );
}

export function parseMessage(message, client = null) {
  const {
    guild,
    author,
    channel,
    content = "",
    mentions,
    member,
    reference,
  } = message;

  const cleaned = content.trim();

  return {
    guildId: guild?.id ?? null,
    channelId: channel.id,
    userId: author.id,
    messageId: message.id,
    timestamp: message.createdTimestamp,
    isBot: author.bot,

    username: author.username,
    displayName: member?.displayName ?? author.username,
    avatarURL: author.displayAvatarURL?.() ?? null,
    roles: member?.roles?.cache ? Array.from(member.roles.cache.keys()) : [],

    text: cleaned,
    textLower: cleaned.toLowerCase(),
    wordCount: cleaned.split(/\s+/).length,
    hasLinks: /https?:\/\//.test(cleaned),
    urls: cleaned.match(/https?:\/\/\S+/g) || [],
    emojis: cleaned.match(/<a?:\w+:\d+>/g) || [],
    isCommand: cleaned.startsWith(dbBot.data.configs.prefix || "$"),
    commandName: cleaned.startsWith(dbBot.data.configs.prefix || "$")
      ? cleaned.split(/\s+/)[0].slice(1)
      : null,

    mentions: {
      users: Array.from(mentions.users.keys()),
      roles: Array.from(mentions.roles.keys()),
      channels: Array.from(mentions.channels.keys()),
      everyone: mentions.everyone,
      here: cleaned.includes("@here"),
      isMentioningClient:
        client && client.user ? mentions.users.has(client.user.id) : false,
    },

    isReply: Boolean(reference?.messageId),
    repliedMessageId: reference?.messageId ?? null,
    repliedUserId: reference?.authorId ?? null,

    isDM: channel.isDMBased?.() ?? false,
    channelType: channel.type,
    guildName: guild?.name ?? null,
    guildMemberCount: guild?.memberCount ?? null,

    randomInt: ((Math.random() * 15) | 0) + 1,
    lettersOnly: cleaned.replace(/[^a-zA-ZÀ-ú ]/g, ""),
    numbersInMessage: cleaned.match(/\d+/g) || [],
    firstWord: cleaned.split(/\s+/)[0] ?? null,
    lastWord: cleaned.split(/\s+/).slice(-1)[0] ?? null,
  };
}

export const replaceMentions = async (message, content) => {
  if (!content) return content;

  const mentionRegex = /<@!?(\d+)>/g;
  let processedContent = content;

  const mentions = content.match(mentionRegex);
  if (mentions) {
    for (const mention of mentions) {
      const userId = mention.match(/\d+/)[0];
      try {
        const user = await message.guild.members.fetch(userId);
        const displayName = user.displayName || user.user.username;
        processedContent = processedContent.replace(mention, `@${displayName}`);
      } catch (error) {
        console.log(`Não foi possível buscar usuário ${userId}`);
      }
    }
  }

  return processedContent;
};

export async function getOrCreateWebhook(channel, author) {
  const webhooks = await channel.fetchWebhooks();
  let hook = webhooks.find((wh) => wh.owner?.id === author.id);
  if (hook) return hook;

  if (webhooks.size >= 15) {
    console.warn("Limite de webhooks atingido, reutilizando existente");
    return webhooks.first();
  }

  try {
    hook = await channel.createWebhook({
      name: "Sistema de Penalidade",
      avatar: author.displayAvatarURL(),
    });
    return hook;
  } catch (err) {
    console.error("Erro ao criar webhook:", err.message);
    return webhooks.first();
  }
}
