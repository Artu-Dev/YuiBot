import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { dbBot, getBotPrefix, getServerConfig, setServerConfig } from "../database.js";

export const name = "config";

export const data = new SlashCommandBuilder()
  .setName("config")
  .setDescription("Ver ou alterar configurações do bot (admin).")
  .addSubcommand((sc) =>
    sc.setName("ver").setDescription("Mostra todas as opções e os valores atuais")
  )
  .addSubcommand((sc) =>
    sc
      .setName("definir")
      .setDescription("Altera uma opção")
      .addStringOption((opt) =>
        opt
          .setName("campo")
          .setDescription("O que você quer mudar")
          .setRequired(true)
          .addChoices(
            {
              name: "Prefixo dos comandos por mensagem",
              value: "prefix",
            },
            {
              name: "Respostas aleatórias com IA no chat",
              value: "random",
            },
            {
              name: "Limite de caracteres (mês)",
              value: "limitChar",
            },
          )
      )
      .addStringOption((opt) =>
        opt
          .setName("valor")
          .setDescription("Novo valor (texto para prefixo; on/off para as outras)")
          .setRequired(true)
      )
  );

const boolize = (raw) => {
  if (!raw) return null;
  const text = raw.toString().toLowerCase();
  if (["true", "on", "1", "yes", "sim"].includes(text)) return true;
  if (["false", "off", "0", "no", "não", "nao"].includes(text)) return false;
  return null;
};

function parseArgs(data) {
  if (data.fromInteraction) {
    const sub = data.getSubcommand(false);
    if (sub === "definir") {
      return {
        mode: "definir",
        field: data.getString("campo"),
        value: data.getString("valor"),
      };
    }
    return { mode: "ver" };
  }

  const args = data.args ?? [];
  if (args.length === 0) return { mode: "ver" };

  const head = args[0]?.toLowerCase();
  if (head === "ver" || head === "ajuda" || head === "help" || head === "lista") {
    return { mode: "ver" };
  }

  if (args[0]?.toLowerCase() === "definir") {
    const [, field, ...valueParts] = args;
    return {
      mode: "definir",
      field: field ?? null,
      value: valueParts.join(" ").trim() || null,
    };
  }

  const [field, ...valueParts] = args;
  return {
    mode: "definir",
    field: field ?? null,
    value: valueParts.join(" ").trim() || null,
  };
}

function buildConfigEmbed(guildId) {
  const c = {
    prefix: getServerConfig(guildId, 'prefix'),
    generateMessage: getServerConfig(guildId, 'generateMessage'),
    speakMessage: getServerConfig(guildId, 'speakMessage'),
    limitChar: getServerConfig(guildId, 'limitChar')
  };
  const p = c.prefix;

  return new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("⚙️ Configuração do bot")
    .setDescription(
      "Use **slash** `/config definir` ou no **chat** com prefixo. " +
        `Prefixo atual: \`${p}\``
    )
    .addFields(
      {
        name: "`prefix` — Prefixo",
        value:
          `**Atual:** \`${c.prefix}\`\n` +
          "Comandos no canal começam com esse caractere (ex.: `$stats`).",
        inline: false,
      },
      {
        name: "`random` / `generate` — IA no chat",
        value:
          `**Atual:** **${c.generateMessage ? "ligado" : "desligado"}**\n` +
          "Se ligado, o bot pode responder mensagens aleatórias com IA em canais permitidos.",
        inline: false,
      },
      {
        name: "`speak` — Voz (TTS)",
        value:
          `**Atual:** **${c.speakMessage ? "ligado" : "desligado"}**\n` +
          "Se ligado, respostas da IA podem ser lidas em call (quando configurado).",
        inline: false,
      },
      {
        name: "`limitChar` — Limite de caracteres (mês)",
        value:
          `**Atual:** **${c.limitChar ?? 4000}**\n` +
          "Limite inicial de caracteres por usuário por mês.",
        inline: false,
      },
      {
        name: "Exemplos (prefixo)",
        value:
          `\`${p}config\` — abre este resumo\n` +
          `\`${p}config prefix !\` — prefixo vira \`!\`\n` +
          `\`${p}config random off\` — desliga respostas IA\n` +
          `\`${p}config speak on\` — liga TTS\n` +
          `\`${p}config limitChar 4000\` — limite vira 4000`,
        inline: false,
      }
    );
}

export async function execute(client, data) {
  const parsed = parseArgs(data);
  const guildId = data.guildId;

  if (parsed.mode === "ver") {
    return data.reply({ embeds: [buildConfigEmbed(guildId)] });
  }

  const { field, value } = parsed;

  if (!field) {
    return data.reply({ embeds: [buildConfigEmbed(guildId)] });
  }

  if (!value && field.toLowerCase() !== "prefix") {
    return data.reply(
      `Informe o valor. Ex.: \`${getBotPrefix(guildId)}config random on\` ou \`/config definir\`.`
    );
  }

  const normalizedField = field.toLowerCase();
  const normalizedValue = value?.trim();

  if (normalizedField === "prefix") {
    if (!normalizedValue) {
      return data.reply("Forneça o novo prefixo. Ex.: `$config prefix !`");
    }
    setServerConfig(guildId, 'prefix', normalizedValue);
    return data.reply(`Prefixo atualizado para: \`${normalizedValue}\``);
  }

  if (normalizedField === "random" || normalizedField === "generate") {
    const bool = boolize(normalizedValue);
    if (bool === null) {
      return data.reply("Valor inválido para **random**. Use **on**, **off**, **sim**, **não**.");
    }
    setServerConfig(guildId, 'generateMessage', bool);
    return data.reply(
      `Respostas aleatórias com IA (**generateMessage**): **${bool ? "ligado" : "desligado"}**.`
    );
  }

  if (normalizedField === "speak" || normalizedField === "speakmessage") {
    const bool = boolize(normalizedValue);
    if (bool === null) {
      return data.reply("Valor inválido para **speak**. Use **on** ou **off**.");
    }
    setServerConfig(guildId, 'speakMessage', bool);
    return data.reply(
      `Fala no voice (**speakMessage**): **${bool ? "ligado" : "desligado"}**.`
    );
  }

  if (normalizedField === "limit" || normalizedField === "limitChar" || normalizedField === "limitchar") {
    const num = parseInt(normalizedValue);
    if (isNaN(num) || num < 0) {
      return data.reply("Valor inválido para **limitChar**. Use um número positivo.");
    }
    setServerConfig(guildId, 'limitChar', num);
    return data.reply(`Limite de caracteres atualizado para: **${num}**.`);
  }

  return data.reply({
    embeds: [buildConfigEmbed(guildId)],
    content: "❌ Campo não reconhecido. Veja a lista acima.",
  });
}
