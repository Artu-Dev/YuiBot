import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { 
  getOrCreateUser, 
  addChars, 
  reduceChars, 
  addUserPropertyByAmount 
} from "../database.js";

export const name = "crash";

export const data = new SlashCommandBuilder()
  .setName("crash")
  .setDescription("🚀 CRASH - Multiplique sua aposta e pare antes de explodir!")
  .addNumberOption(option =>
    option
      .setName("aposta")
      .setDescription("Quantidade de chars pra apostar (mín. 50)")
      .setRequired(true)
      .setMinValue(50)
  );

export async function execute(client, data) {
  const { userId, guildId, displayName, fromInteraction } = data;

  let aposta;
  if (fromInteraction) {
    aposta = data.getNumber("aposta");
  } else {
    aposta = parseInt(data.args[0] || "0");
  }

  if (!aposta || isNaN(aposta) || aposta < 50) {
    return await data.reply(`**${displayName}**, a aposta mínima é **50 chars**. Exemplo: \`crash 500\``);
  }

  const user = getOrCreateUser(userId, displayName, guildId);
  const charLeft = Number(user.charLeft) || 0;

  if (aposta > charLeft) {
    return await data.reply(`**${displayName}**, tu só tem **${charLeft.toLocaleString()}** chars. Aposta algo que tu tem, seu liso!`);
  }

  reduceChars(userId, guildId, aposta);

  let multiplier = 1.0;
  let step = 0;

  const crashStep = Math.ceil(Math.pow(Math.random(), 1.85) * 22) + 2;

  let gameActive = true;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`crash_stop_${userId}`)
      .setEmoji("🛑")
      .setLabel("PARAR AGORA")
      .setStyle(ButtonStyle.Danger)
  );

  const embed = new EmbedBuilder()
    .setColor("#ff0000")
    .setTitle(`🚀 CRASH • ${displayName}`)
    .setDescription("O multiplier tá subindo... **Reaja com 🛑 pra parar antes do BOOM!**")
    .addFields(
      { name: "Multiplier", value: `**${multiplier.toFixed(1)}x**`, inline: true },
      { name: "Lucro Atual", value: `**0** chars`, inline: true },
      { name: "Aposta", value: `${aposta.toLocaleString()} chars`, inline: true }
    );

  const msg = await data.reply({ embeds: [embed], components: [row], fetchReply: true });

  // ===================== LOOP =====================
  const gameInterval = setInterval(async () => {
    if (!gameActive) return clearInterval(gameInterval);

    step++;

    // CRASH
    if (step >= crashStep) {
      gameActive = false;
      clearInterval(gameInterval);

      addUserPropertyByAmount("tiger_plays", userId, guildId, 1);
      addUserPropertyByAmount("tiger_losses", userId, guildId, 1);

      embed
        .setColor("#000000")
        .setDescription("💥 **CRASH!** Explodiu tudo, seu azarado do caralho.")
        .spliceFields(0, 3, { 
          name: "Resultado", 
          value: `**- ${aposta.toLocaleString()} chars**`, 
          inline: false 
        });

      await msg.edit({ embeds: [embed], components: [] });
      return;
    }

    multiplier += 0.07;
    const lucroAtual = Math.floor(aposta * multiplier) - aposta;

    embed.spliceFields(0, 3,
      { name: "Multiplier", value: `**${multiplier.toFixed(1)}x**`, inline: true },
      { name: "Lucro Atual", value: `**+${lucroAtual.toLocaleString()}** chars`, inline: true },
      { name: "Aposta", value: `${aposta.toLocaleString()} chars`, inline: true }
    );

    await msg.edit({ embeds: [embed], components: [row] });
  }, 1100);

  // ===================== BOTÃO =====================
  const collector = msg.createMessageComponentCollector({
    filter: i => i.user.id === userId && i.customId === `crash_stop_${userId}`,
    max: 1,
    time: 90000
  });

  collector.on("collect", async i => {
    if (!gameActive) return;

    gameActive = false;
    clearInterval(gameInterval);

    const lucroFinal = Math.floor(aposta * multiplier) - aposta;
    const totalRecebido = aposta + lucroFinal;

    addChars(userId, guildId, totalRecebido);

    addUserPropertyByAmount("tiger_plays", userId, guildId, 1);
    addUserPropertyByAmount("tiger_wins", userId, guildId, 1);

    embed
      .setColor("#00ff00")
      .setDescription(`✅ **PAROU NA HORA CERTA, PORRA!**\nParou em **${multiplier.toFixed(1)}x** e levou **${totalRecebido.toLocaleString()} chars**!`)
      .spliceFields(0, 3, { 
        name: "Resultado", 
        value: `**+${lucroFinal.toLocaleString()} chars**`, 
        inline: false 
      });

    const disableRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`crash_stop_${userId}`)
        .setEmoji("🛑")
        .setLabel("PARADO")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true)
    );

    await i.update({ embeds: [embed], components: [disableRow] });
  });
}