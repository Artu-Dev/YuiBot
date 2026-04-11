  import { dbBot, getServerConfig } from "../database.js";
  import ms from 'ms';
  import { random } from 'es-toolkit';
  import { PermissionFlagsBits } from 'discord.js';

  export function getRandomTime(minSeconds, maxSeconds) {
    return random(ms(`${minSeconds}s`), ms(`${maxSeconds}s`));
  }

  function parseArgs(content) {
    const args = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = null;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = null;
      } else if (char === ' ' && !inQuotes) {
        if (current.length > 0) {
          args.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current.length > 0) args.push(current);
    return args;
  }

  function parseFlag(args, name, shortName = null) {
    const patterns = [
      `--${name}`,
      shortName ? `-${shortName}` : null
    ].filter(Boolean);

    for (let i = 0; i < args.length; i++) {
      if (patterns.includes(args[i])) {
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          return { value: args[i + 1], index: i, length: 2 };
        }
        return { value: true, index: i, length: 1 };
      }
      
      if (args[i].startsWith(`${patterns[0]}=`)) {
        return { value: args[i].split('=')[1], index: i, length: 1 };
      }
    }
    return null;
  }

  export function contextFromMessage(message, options = {}) {
    const { prefix = getServerConfig(message.guild?.id, 'prefix') || '$', schema = null, subcommands = [] } = options;
    
    const contentWithoutPrefix = message.content.slice(prefix.length).trim();
    const parts = contentWithoutPrefix.split(/ +/);
    const commandName = parts[0];
    const contentAfterCommand = contentWithoutPrefix.slice(commandName.length).trim();
    
    const rawArgs = parseArgs(contentAfterCommand);
    
    let detectedSubcommand = null;
    let argsWithoutSub = [...rawArgs];
    
    if (rawArgs.length > 0 && subcommands.includes(rawArgs[0].toLowerCase())) {
      detectedSubcommand = rawArgs[0].toLowerCase();
      argsWithoutSub = rawArgs.slice(1);
    }

    const schemaMap = schema ? Object.fromEntries(schema.map(s => [s.name, s])) : {};

    return {
      userId: message.author.id,
      guildId: message.guild?.id,
      channelId: message.channel.id,
      username: message.author.username,
      displayName: message.member?.displayName ?? message.author.username,
      avatarURL: (opts) => message.author.displayAvatarURL(opts),
      isBot: message.author.bot,
      isEphemeral: false,
      mentionedUser: message.mentions.users.first() ?? null,
      voiceChannel: message.member?.voice?.channel ?? null,
      fromInteraction: false,
      content: message.content,
      args: rawArgs,

      adapterCreator: message.guild?.voiceAdapterCreator ?? null,

      reply: (content) => message.reply(normalize(content)),
      followUp: (content) => message.channel.send(normalize(content)),
      editReply: null,
      deferReply: null,

      hasPermission: (perm) => message.member?.permissions.has(perm) ?? false,
      isAdmin: () => message.member?.permissions.has(PermissionFlagsBits.ManageChannels) ?? false,

      getSubcommand: (required = false) => {
        if (required && !detectedSubcommand) {
          throw new Error("Subcommando obrigatório não fornecido.");
        }
        return detectedSubcommand;
      },

      getString: (name, required = false) => {
        let value = null;
        
        if (schemaMap[name]) {
          const index = schema.findIndex(s => s.name === name);
          const adjustedIndex = detectedSubcommand ? index - 1 : index;
          
          if (adjustedIndex >= 0 && adjustedIndex < argsWithoutSub.length) {
            value = argsWithoutSub[adjustedIndex];
          }
          
          const flag = parseFlag(argsWithoutSub, name, name[0]);
          if (flag) value = flag.value;
        } else {
          const flag = parseFlag(argsWithoutSub, name, name[0]);
          if (flag) value = flag.value;
          else if (argsWithoutSub.length > 0) value = argsWithoutSub.join(' ');
        }

        if (required && !value) throw new Error(`Opção "${name}" é obrigatória.`);
        return value;
      },

      getInteger: (name, required = false) => {
        const str = context.getString(name);
        if (!str) {
          if (required) throw new Error(`Opção "${name}" é obrigatória.`);
          return null;
        }
        const num = parseInt(str.replace(/[^\d-]/g, ''), 10);
        return isNaN(num) ? null : num;
      },

      getNumber: (name, required = false) => {
        const str = context.getString(name);
        if (!str) {
          if (required) throw new Error(`Opção "${name}" é obrigatória.`);
          return null;
        }
        const num = parseFloat(str.replace(/[^\d.-]/g, ''));
        return isNaN(num) ? null : num;
      },

      getBoolean: (name, required = false) => {
        const flag = parseFlag(argsWithoutSub, name, name[0]);
        if (flag) return true;
        
        const str = context.getString(name);
        if (!str) {
          if (required) throw new Error(`Opção "${name}" é obrigatória.`);
          return false;
        }
        return ['true', '1', 'yes', 'sim', 'on'].includes(str.toLowerCase());
      },

      getUser: (name, required = false) => {
        let user = null;
        
        if (schemaMap[name]?.type === 'USER') {
          const index = schema.findIndex(s => s.name === name);
          const adjustedIndex = detectedSubcommand ? index - 1 : index;
          const arg = argsWithoutSub[adjustedIndex];
          
          if (arg) {
            const id = arg.replace(/[<@!>]/g, '');
            user = message.mentions.users.get(id) || 
                  message.client.users.cache.get(id);
          }
        }
        
        if (!user) {
          user = message.mentions.users.first();
        }
        
        if (!user) {
          const flag = parseFlag(argsWithoutSub, name, name[0]);
          if (flag?.value) {
            const id = String(flag.value).replace(/[<@!>]/g, '');
            user = message.client.users.cache.get(id);
          }
        }

        if (required && !user) throw new Error(`Usuário "${name}" é obrigatório.`);
        return user;
      },

      getMember: (name, required = false) => {
        const user = context.getUser(name);
        if (!user) {
          if (required) throw new Error(`Membro "${name}" é obrigatório.`);
          return null;
        }
        return message.guild?.members.cache.get(user.id) ?? null;
      },

      getChannel: (name, required = false) => {
        let channel = null;
        
        if (schemaMap[name]?.type === 'CHANNEL') {
          const index = schema.findIndex(s => s.name === name);
          const adjustedIndex = detectedSubcommand ? index - 1 : index;
          const arg = argsWithoutSub[adjustedIndex];
          
          if (arg) {
            const id = arg.replace(/[<#>]/g, '');
            channel = message.mentions.channels.get(id) ||
                    message.guild?.channels.cache.get(id);
          }
        }
        
        // Fallback
        if (!channel) {
          channel = message.mentions.channels.first();
        }
        
        // Flag --channel
        if (!channel) {
          const flag = parseFlag(argsWithoutSub, name, name[0]);
          if (flag?.value) {
            const id = String(flag.value).replace(/[<#>]/g, '');
            channel = message.guild?.channels.cache.get(id);
          }
        }

        if (required && !channel) throw new Error(`Canal "${name}" é obrigatório.`);
        return channel;
      },

      getRole: (name, required = false) => {
        let role = null;
        
        if (schemaMap[name]?.type === 'ROLE') {
          const index = schema.findIndex(s => s.name === name);
          const adjustedIndex = detectedSubcommand ? index - 1 : index;
          const arg = argsWithoutSub[adjustedIndex];
          
          if (arg) {
            const id = arg.replace(/[<@&>]/g, '');
            role = message.mentions.roles.get(id) ||
                  message.guild?.roles.cache.get(id);
          }
        }
        
        if (!role) role = message.mentions.roles.first();
        
        // Flag --role
        if (!role) {
          const flag = parseFlag(argsWithoutSub, name, name[0]);
          if (flag?.value) {
            const id = String(flag.value).replace(/[<@&>]/g, '');
            role = message.guild?.roles.cache.get(id);
          }
        }

        if (required && !role) throw new Error(`Cargo "${name}" é obrigatório.`);
        return role;
      }
    };
  }

  export function contextFromInteraction(interaction) {
    const user = interaction.user ?? interaction.member?.user;
    if (!user) throw new Error("Usuário não encontrado na interação.");

    const opts = interaction.options;

    return {
      userId: user.id,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      username: user.username,
      displayName: interaction.member?.displayName ?? user.displayName ?? user.username,
      avatarURL: (opts) => user.displayAvatarURL(opts),
      isBot: user.bot,
      isEphemeral: true,
      mentionedUser: opts.getUser("usuário") ?? null,
      voiceChannel: interaction.member?.voice?.channel ?? null,
      fromInteraction: true,
      content: `/${opts.getSubcommand(false) ?? opts.getSubcommandGroup(false) ?? interaction.commandName}`,
      args: [], 

      reply: (content) => {
        const normalized = normalize(content);
        return interaction.replied || interaction.deferred
          ? interaction.followUp(normalized)
          : interaction.reply(normalized);
      },
      followUp: (content) => interaction.followUp(normalize(content)),
      editReply: (content) => interaction.editReply(normalize(content)),
      deferReply: (opts) => interaction.deferReply(opts),

      hasPermission: (perm) => interaction.member?.permissions.has(perm) ?? false,
      isAdmin: () => interaction.member?.permissions.has(PermissionFlagsBits.ManageChannels) ?? false,

      getSubcommand: (required = false) => {
        const sub = opts.getSubcommand(false);
        if (required && !sub) throw new Error("Subcommando obrigatório.");
        return sub;
      },

      getString: (name, required = false) => opts.getString(name) ?? (required ? (() => { throw new Error(`"${name}" é obrigatório.`) })() : null),
      getInteger: (name, required = false) => opts.getInteger(name) ?? (required ? (() => { throw new Error(`"${name}" é obrigatório.`) })() : null),
      getNumber: (name, required = false) => opts.getNumber(name) ?? (required ? (() => { throw new Error(`"${name}" é obrigatório.`) })() : null),
      getBoolean: (name, required = false) => opts.getBoolean(name) ?? (required ? (() => { throw new Error(`"${name}" é obrigatório.`) })() : false),
      getUser: (name, required = false) => opts.getUser(name) ?? (required ? (() => { throw new Error(`"${name}" é obrigatório.`) })() : null),
      getMember: (name, required = false) => opts.getMember(name) ?? (required ? (() => { throw new Error(`"${name}" é obrigatório.`) })() : null),
      getChannel: (name, required = false) => opts.getChannel(name) ?? (required ? (() => { throw new Error(`"${name}" é obrigatório.`) })() : null),
      getRole: (name, required = false) => opts.getRole(name) ?? (required ? (() => { throw new Error(`"${name}" é obrigatório.`) })() : null),
    };
  }

  function normalize(content) {
    if (typeof content === "string") return { content };
    if (content && typeof content === "object" && !content.content && !content.embeds) {
      return { content: String(content) };
    }
    return content;
  }

  export function messageContainsDailyWord(text) {
    const w = dbBot.data?.configs?.dailyWord;
    if (!w || typeof text !== "string") return false;
    return text.toLowerCase().includes(String(w).trim().toLowerCase());
  }

  export async function safeReplyToMessage(message, content) {
    const text = typeof content === "string" ? content : String(content ?? "");
    const safe =
      text.length > 2000 ? `${text.slice(0, 1999)}…` : text;
    if (!safe.trim()) {
      throw new Error("Conteúdo vazio para reply");
    }
    try {
      return await message.reply({ content: safe });
      
    } catch (err) {
      const raw = JSON.stringify(err?.rawError ?? {});
      const refUnknown =
        err?.code === 10008 ||
        (err?.code === 50035 &&
          (raw.includes("MESSAGE_REFERENCE_UNKNOWN_MESSAGE") ||
            String(err?.message ?? "").includes("Unknown message")));

      if (!refUnknown) throw err;
      if (!message.channel?.isTextBased?.()) throw err;
      
      const uid = message.author?.id;
      const prefix = uid ? `<@${uid}> ` : "";
      return await message.channel.send({
        content: `${prefix}${safe}`,
        allowedMentions: uid ? { users: [uid] } : { parse: [] },
      });
    }
  }

  export function resolveDisplayAvatarURL(userLike, options) {
    if (!userLike || typeof userLike.displayAvatarURL !== "function") return null;
    try {
      const url = userLike.displayAvatarURL(options);
      return typeof url === "string" && url.length > 0 ? url : null;
    } catch {
      return null;
    }
  }

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
      isCommand: cleaned.startsWith(getServerConfig(message.guildId, 'prefix') || "$"),
      commandName: cleaned.startsWith(getServerConfig(message.guildId, 'prefix') || "$")
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

    if (webhooks.size >= 10) {
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
      
      if (webhooks.size === 0) {
        throw new Error("Não foi possível criar webhook e não existe nenhum disponível no canal.");
      }
      return webhooks.first();
    }
  }
