import { dbBot } from "../database.js";

export const name = "config";

const boolize = (raw) => {
  if (!raw) return null;
  const text = raw.toString().toLowerCase();
  if (["true", "on", "1", "yes", "sim"].includes(text)) return true;
  if (["false", "off", "0", "no", "não", "nao"].includes(text)) return false;
  return null;
};

export async function run(client, message) {
  const guildId = message.guild.id;
  const rawText = message.content.trim();
  const prefix = rawText.startsWith("/") ? "/" : "";
  const withoutPrefix = prefix ? rawText.slice(1).trim() : rawText;
  const parts = withoutPrefix.split(/\s+/).slice(1);

  if (parts.length === 0) {
    const c = dbBot.data.configs;
    return message.reply(
      `Config atual:\n- prefix: ${c.prefix}\n- generateMessage: ${c.generateMessage}\n- speakMessage: ${c.speakMessage}`
    );
  }

  const field = parts[0].toLowerCase();
  const value = parts[1];

  if (!value) {
    return message.reply(
      "Uso: /config <prefix|random|speak> <valor>. Ex: /config prefix $ | /config random on | /config speak off"
    );
  }

  if (field === "prefix") {
    dbBot.data.configs.prefix = value;
    await dbBot.write();
    return message.reply(`Prefix atualizado para: ${value}`);
  }

  if (field === "random" || field === "generate") {
    const bool = boolize(value);
    if (bool === null) return message.reply("Valor inválido. Use on/off ou true/false.");
    dbBot.data.configs.generateMessage = bool;
    await dbBot.write();
    return message.reply(`generateMessage definido para ${bool}`);
  }

  if (field === "speak" || field === "speakmessage") {
    const bool = boolize(value);
    if (bool === null) return message.reply("Valor inválido. Use on/off ou true/false.");
    dbBot.data.configs.speakMessage = bool;
    await dbBot.write();
    return message.reply(`speakMessage definido para ${bool}`);
  }

  return message.reply(
    "Campo inválido. Use prefix, random/generate ou speak/speakMessage."
  );
}

export async function runInteraction(client, interaction) {
  const field = interaction.options.getString("campo");
  const value = interaction.options.getString("valor");

  if (!field) {
    const c = dbBot.data.configs;
    return interaction.reply({
      content: `Config atual:\n- prefix: ${c.prefix}\n- generateMessage: ${c.generateMessage}\n- speakMessage: ${c.speakMessage}`,
      ephemeral: true,
    });
  }

  if (!value && field !== "prefix") {
    return interaction.reply({
      content: "Para esse campo, você deve informar um valor. Ex: /config campo random valor on",
      ephemeral: true,
    });
  }

  const normalizedField = field.toLowerCase();
  const normalizedValue = value?.trim();

  if (normalizedField === "prefix") {
    if (!normalizedValue) {
      return interaction.reply({ content: "Forneça um prefixo válido.", ephemeral: true });
    }
    dbBot.data.configs.prefix = normalizedValue;
    await dbBot.write();
    return interaction.reply({ content: `Prefix atualizado para: ${normalizedValue}`, ephemeral: true });
  }

  if (normalizedField === "random" || normalizedField === "generate") {
    const bool = boolize(normalizedValue);
    if (bool === null) {
      return interaction.reply({ content: "Valor inválido. Use on/off ou true/false.", ephemeral: true });
    }
    dbBot.data.configs.generateMessage = bool;
    await dbBot.write();
    return interaction.reply({ content: `generateMessage definido para ${bool}`, ephemeral: true });
  }

  if (normalizedField === "speak" || normalizedField === "speakmessage") {
    const bool = boolize(normalizedValue);
    if (bool === null) {
      return interaction.reply({ content: "Valor inválido. Use on/off ou true/false.", ephemeral: true });
    }
    dbBot.data.configs.speakMessage = bool;
    await dbBot.write();
    return interaction.reply({ content: `speakMessage definido para ${bool}`, ephemeral: true });
  }

  return interaction.reply({ content: "Campo inválido. Use prefix, random/generate ou speak/speakMessage.", ephemeral: true });
}

