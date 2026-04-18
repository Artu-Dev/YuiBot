import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ChannelFlags } from "discord.js";
import { getOrCreateUser, getBotPrefix, getServerConfig } from "../database.js";
import { CLASSES, CLASS_KEYS_ORDERED, unlockClass, formatModifier } from "../functions/classes.js";
import { customEmojis } from "../functions/utils.js";

export const name = "classe";
export const aliases = ["classes", "class", "cls"];
export const requiresCharLimit = true;

const attributeDescriptions = {
  lucky: "Sorte no tigre",
  robCost: "Custo de roubo",
  robDamage: "Dano de roubo",
  robDefense: "Defesa contra roubo",
  robSuccess: "Chance de sucesso do roubo",
  singleRobSuccess: "Chance de sucesso do roubo específico",
  singleRobDamage: "Dano do roubo específico",
};

function getColorByPrice(cost) {
  if (cost === 0)         return 0x95A5A6;
  if (cost < 501)     return 0x2ECC71;
  if (cost < 1001)     return 0x3498DB;
  if (cost < 1501)    return 0x9B59B6; 
  if (cost < 2001)    return 0xF39C12;
  if (cost < 2501)    return 0xE67E22;
  return 0xE74C3C;
}

function buildRow(currentIndex, userData) {
  const classKey = CLASS_KEYS_ORDERED[currentIndex];
  const cls = CLASSES[classKey];
  const isOwned = userData.user_class === classKey;
  const canAfford = classKey === "none" || userData.charLeft >= cls.unlockCost;
  const canBuy = !isOwned && canAfford;

  const components = [
    new ButtonBuilder()
      .setCustomId("prev")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentIndex === 0),
    new ButtonBuilder()
      .setCustomId("next")
      .setEmoji("▶️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentIndex === CLASS_KEYS_ORDERED.length - 1),
  ];

  if (canBuy) {
    components.push(
      new ButtonBuilder()
        .setCustomId("buy")
        .setLabel("Comprar")
        .setStyle(ButtonStyle.Success)
    );
  }

  return new ActionRowBuilder().addComponents(...components);
}

export const data = new SlashCommandBuilder()
  .setName("classe")
  .setDescription("Sistema de classes que modificam seus atributos");

export async function execute(client, data) {
  const { userId, guildId, displayName } = data;
  
  if (!getServerConfig(guildId, 'charLimitEnabled')) {
    return await data.reply("❌ O sistema de caracteres está desligado neste servidor!");
  }
  
  if (!getServerConfig(guildId, 'classesEnabled')) {
    return await data.reply("❌ O sistema de classes está desabilitado neste servidor!");
  }

  const userData = getOrCreateUser(userId, displayName, guildId);

  const currentClassKey = userData.user_class ?? "none";

  let startIndex = CLASS_KEYS_ORDERED.indexOf(currentClassKey);
  if (startIndex === -1) startIndex = 0;

  const embed = buildClassEmbed(startIndex, userData);
  const row = buildRow(startIndex, userData);

  const reply = await data.reply({
    embeds: [embed],
    components: [row],
    fetchReply: true
  });

  const collector = reply.createMessageComponentCollector({
    time: 120000
  });

  collector.on("collect", async (interaction) => {
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: "❌ Apenas quem executou o comando pode usar os botões.", flags: ChannelFlags.Ephemeral });
    }

    let currentIndex = CLASS_KEYS_ORDERED.indexOf(
      interaction.message.embeds[0].footer.text.match(/Classe: (\w+)/)?.[1] || "none"
    );

    if (interaction.customId === "prev") {
      currentIndex = Math.max(0, currentIndex - 1);
    } else if (interaction.customId === "next") {
      currentIndex = Math.min(CLASS_KEYS_ORDERED.length - 1, currentIndex + 1);
    } else if (interaction.customId === "buy") {
      const classKey = CLASS_KEYS_ORDERED[currentIndex];
      const targetClass = CLASSES[classKey];
      const freshUserData = getOrCreateUser(userId, displayName, guildId);

      if (classKey === freshUserData.user_class) {
        return interaction.reply({ content: `ℹ️ Você já é **${targetClass.name}**!`, flags: ChannelFlags.Ephemeral });
      }

      if (classKey !== "none" && freshUserData.charLeft < targetClass.unlockCost) {
        const falta = (targetClass.unlockCost - freshUserData.charLeft).toLocaleString();
        return interaction.reply({
          content: `❌ Chars insuficientes. Faltam **${falta}** para liberar **${targetClass.name}**.`,
          flags: ChannelFlags.Ephemeral
        });
      }

      const success = unlockClass(userId, guildId, classKey);
      if (!success) {
        return interaction.reply({ content: "❌ Ocorreu um erro ao desbloquear a classe.", flags: ChannelFlags.Ephemeral });
      }

      const updatedUser = getOrCreateUser(userId, displayName, guildId);
      const newEmbed = buildClassEmbed(currentIndex, updatedUser);
      const newRow = buildRow(currentIndex, updatedUser);

      await interaction.update({ embeds: [newEmbed], components: [newRow] });

      return interaction.followUp({
        content: `✅ Classe **${targetClass.name}** desbloqueada com sucesso!`,
        flags: ChannelFlags.Ephemeral
      });
    }

    const freshUserData = getOrCreateUser(userId, displayName, guildId);
    const newEmbed = buildClassEmbed(currentIndex, freshUserData);
    const newRow = buildRow(currentIndex, freshUserData);

    await interaction.update({ embeds: [newEmbed], components: [newRow] });
  });

  collector.on("end", () => {
    reply.edit({ components: [] }).catch(() => {});
  });
}

function buildClassEmbed(index, userData) {
  const classKey = CLASS_KEYS_ORDERED[index];
  const cls = CLASSES[classKey];
  const isOwned = userData.user_class === classKey;

  const modifiersList = Object.entries(cls.modifiers)
    .filter(([_, val]) => val !== 0)
    .map(([key, val]) => `▸ ${attributeDescriptions[key] || key}: ${formatModifier(val)}`)
    .join("\n") || "Nenhum modificador ativo.";

  const costText = cls.unlockCost > 0
    ? `${cls.unlockCost.toLocaleString()} chars`
    : "GRÁTIS";

  const status = isOwned ? "✅ **CLASSE ATUAL**" : "";

  const embed = new EmbedBuilder()
    .setTitle(`${cls.name} ${status}`)
    .setDescription(cls.description)
    .setThumbnail(cls.image)
    .addFields(
      { name: `${customEmojis.mineLegendHero} Modificadores`, value: modifiersList, inline: false },
      { name: `${customEmojis.lapislazuli} Custo de desbloqueio`, value: costText, inline: true },
      { name: `${customEmojis.lapislazuli} Seus chars`, value: userData.charLeft.toLocaleString(), inline: true }
    )
    .setFooter({ text: `Classe: ${classKey} | ${index + 1}/${CLASS_KEYS_ORDERED.length}` })
    .setColor(isOwned ? 0x00FF00 : getColorByPrice(cls.unlockCost));

  return embed;
}