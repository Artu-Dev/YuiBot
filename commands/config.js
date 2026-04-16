import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ComponentType,
  ChannelFlags 
} from "discord.js";

import { getServerConfig, setServerConfig } from "../database.js";

export const name = "config";
export const aliases = ["cfg", "settings", "configurações", "ajustes"];

export const data = new SlashCommandBuilder()
  .setName("config")
  .setDescription("Configurações do bot (apenas administradores)");

const configOptions = [
  {
    label: "Prefixo dos comandos",
    value: "prefix",
    description: "Ex: ! ou $",
    type: "text"
  },
  {
    label: "Respostas aleatórias com IA",
    value: "generateMessage",
    description: "IA responde mensagens no chat",
    type: "boolean"
  },
  {
    label: "Fala no Voice (TTS)",
    value: "speakMessage",
    description: "Respostas lidas em call",
    type: "boolean"
  },
  {
    label: "Limite de caracteres (mês)",
    value: "limitChar",
    description: "Limite inicial por usuário",
    type: "number"
  },
  {
    label: "Sistema de limitador de chars",
    value: "charLimitEnabled",
    description: "Habilitar/desabilitar economia de chars",
    type: "boolean"
  }
];

function buildMainEmbed(guildId) {
  const prefix = getServerConfig(guildId, 'prefix') || "!";
  const generate = getServerConfig(guildId, 'generateMessage') ?? false;
  const speak = getServerConfig(guildId, 'speakMessage') ?? false;
  const limit = getServerConfig(guildId, 'limitChar') ?? 4000;
  const charLimitEnabled = getServerConfig(guildId, 'charLimitEnabled') ?? true;

  return new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("⚙️ Configurações do Servidor")
    .setDescription("Escolha uma opção abaixo para alterar:")
    .addFields(
      { name: "Prefixo", value: `\`${prefix}\``, inline: true },
      { name: "IA no Chat", value: generate ? "✅ Ligado" : "❌ Desligado", inline: true },
      { name: "TTS no Voice", value: speak ? "✅ Ligado" : "❌ Desligado", inline: true },
      { name: "Limite de Chars", value: `${limit}`, inline: true },
      { name: "Limitador de Chars", value: charLimitEnabled ? "✅ Ligado" : "❌ Desligado", inline: true }
    )
    .setFooter({ text: "Apenas administradores podem alterar • Expira em 60 segundos" });
}

export async function execute(client, data) {
  const guildId = data.guildId;
  const userId = data.userId;
  const isAdmin = data.isAdmin();

  if (!isAdmin) {
    return data.reply({ 
      content: "❌ Apenas administradores podem usar este comando.", 
      flags: ChannelFlags.Ephemeral 
    });
  }

  const embed = buildMainEmbed(guildId);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`config_select_${userId}`)
    .setPlaceholder("Escolha uma configuração para alterar...")
    .addOptions(
      configOptions.map(opt => ({
        label: opt.label,
        description: opt.description,
        value: opt.value
      }))
    );

  const cancelButton = new ButtonBuilder()
    .setCustomId(`config_cancel_${userId}`)
    .setLabel("Cancelar")
    .setStyle(ButtonStyle.Danger);

  const row1 = new ActionRowBuilder().addComponents(selectMenu);
  const row2 = new ActionRowBuilder().addComponents(cancelButton);

  const response = await data.reply({
    embeds: [embed],
    components: [row1, row2],
    flags: ChannelFlags.Ephemeral 
  });

  const collector = response.createMessageComponentCollector({
    time: 120000, // 2 minutos
    filter: i => i.user.id === userId
  });

  collector.on('collect', async (interaction) => {
    
    if (interaction.isStringSelectMenu()) {
      const selectedValue = interaction.values[0];
      const option = configOptions.find(o => o.value === selectedValue);

      await interaction.deferUpdate();

      if (option.type === "boolean") {
        const yesBtn = new ButtonBuilder()
          .setCustomId(`config_set_${selectedValue}_true_${userId}`)
          .setLabel("Ligar ✅")
          .setStyle(ButtonStyle.Success);

        const noBtn = new ButtonBuilder()
          .setCustomId(`config_set_${selectedValue}_false_${userId}`)
          .setLabel("Desligar ❌")
          .setStyle(ButtonStyle.Danger);

        const backBtn = new ButtonBuilder()
          .setCustomId(`config_back_${userId}`)
          .setLabel("Voltar")
          .setStyle(ButtonStyle.Secondary);

        const btnRow = new ActionRowBuilder().addComponents(yesBtn, noBtn, backBtn);

        await interaction.editReply({
          content: `**${option.label}**\nEscolha o novo estado:`,
          embeds: [],
          components: [btnRow]
        });

      } else {
        await interaction.editReply({
          content: `Digite o novo valor para **${option.label}**:\nExemplo: \`!\` ou \`5000\``,
          embeds: [],
          components: []
        });

        const msgCollector = interaction.channel.createMessageCollector({
          filter: m => m.author.id === userId,
          time: 30000,
          max: 1
        });

        msgCollector.on('collect', async (msg) => {
          let newValue = msg.content.trim();

          if (option.type === "number") {
            const num = parseInt(newValue);
            if (isNaN(num) || num < 0) {
              return msg.reply("❌ Valor inválido. Use um número positivo.");
            }
            newValue = num;
          }

          setServerConfig(guildId, selectedValue, newValue);
          await msg.delete().catch(() => {});

          const successEmbed = buildMainEmbed(guildId);
          await interaction.editReply({
            content: `✅ **${option.label}** atualizado com sucesso!`,
            embeds: [successEmbed],
            components: [new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`config_back_${userId}`).setLabel("Voltar ao Menu").setStyle(ButtonStyle.Secondary)
            )]
          });
        });
      }
    } 
    
    // Tratamento para os Botões
    else if (interaction.isButton()) {
      const customId = interaction.customId;

      await interaction.deferUpdate();

      // Botão Cancelar
      if (customId === `config_cancel_${userId}`) {
        collector.stop();
        await interaction.editReply({
          content: "❌ Configuração cancelada.",
          embeds: [],
          components: []
        });
        return;
      }

      // Botão Voltar
      if (customId === `config_back_${userId}`) {
        const mainEmbed = buildMainEmbed(guildId);
        await interaction.editReply({
          content: null,
          embeds: [mainEmbed],
          components: [row1, row2]
        });
        return;
      }

      if (customId.startsWith("config_set_")) {
        const parts = customId.split("_");
        const settingName = parts[2]; // ex: generateMessage
        const newValueStr = parts[3]; // 'true' ou 'false'
        const newValue = newValueStr === "true";

        setServerConfig(guildId, settingName, newValue);

        const successEmbed = buildMainEmbed(guildId);
        
        await interaction.editReply({
          content: `✅ Configuração atualizada com sucesso!`,
          embeds: [successEmbed],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`config_back_${userId}`).setLabel("Voltar ao Menu").setStyle(ButtonStyle.Secondary)
          )]
        });
      }
    }
  });

  collector.on('end', () => {
    response.edit({ components: [] }).catch(() => {});
  });
}