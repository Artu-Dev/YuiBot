import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { 
  getOrCreateUser, 
  addChars, 
  reduceChars, 
  addUserPropertyByAmount 
} from "../database.js";
import { getClassModifier } from "../functions/classes.js";

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

  const classLucky = getClassModifier(user.user_class || "none", "lucky");

  let multiplier = 0.5;
  let step = 0;
  let crashStep;

  if (classLucky === 1) {
    const r = Math.random();
    let min, max;
    
    if (r < 0.15) {
      min = 2; max = 6;       // ≤1.0x
    } else if (r < 0.80) {
      min = 7; max = 16;      // 1.1x – 2.0x
    } else if (r < 0.992) {
      min = 17; max = 46;     // 2.1x – 5.0x
    } else {
      min = 47; max = 100;    // >5.0x
    }
    
    const range = max - min + 1;
    const u = Math.random();
    const index = Math.floor(Math.pow(u, 1.5) * range);
    crashStep = min + index;
    
  } else if (classLucky === 0) {
    const r = Math.random();
    let min, max;
    
    if (r < 0.75) {
      min = 2; max = 16;
    } else if (r < 0.80) {
      min = 17; max = 26;
    } else if (r < 0.90) {
      min = 27; max = 36;
    } else {
      min = 37; max = 100;
    }
    
    const range = max - min + 1;
    const u = Math.random();
    const index = Math.floor(Math.pow(u, 1.3) * range);
    crashStep = min + index;
    
  } else {
    
    const baseExponent = 1.75;
    const baseScale    = 17;
    const baseAdd      = 2;

    const luckEffectExponent = classLucky * 0.165;
    const luckEffectScale    = classLucky * 4.8;

    const exponent = Math.max(1.05, baseExponent - luckEffectExponent);
    const scale    = Math.max(12, baseScale + luckEffectScale);

    crashStep = Math.ceil(Math.pow(Math.random(), exponent) * scale) + baseAdd;
  }

  // Multiplier exato no momento do crash e maior prêmio possível
  const crashMultiplier = parseFloat((0.5 + (crashStep - 1) * 0.10).toFixed(1));
  const maxPayout       = Math.floor(aposta * crashMultiplier);
  const maxLucro        = maxPayout - aposta;

  // Flag para travar o jogo — usada tanto no interval quanto no collector
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
    .setDescription("O multiplier tá subindo... **Clica em 🛑 pra parar antes do BOOM!**")
    .addFields(
      { name: "Multiplier", value: `**${multiplier.toFixed(1)}x**`, inline: true },
      { name: "Lucro Atual", value: `**0** chars`, inline: true },
      { name: "Aposta", value: `${aposta.toLocaleString()} chars`, inline: true }
    );

  const msg = await data.reply({ embeds: [embed], components: [row], fetchReply: true });

  // ===================== LOOP =====================
  const gameInterval = setInterval(async () => {
    if (!gameActive) {
      clearInterval(gameInterval);
      return;
    }

    step++;

    if (step >= crashStep) {
      gameActive = false;
      clearInterval(gameInterval);

      addUserPropertyByAmount("tiger_plays", userId, guildId, 1);
      addUserPropertyByAmount("tiger_losses", userId, guildId, 1);

      const updatedUser = getOrCreateUser(userId, displayName, guildId);

      embed
        .setColor("#000000")
        .setDescription("💥 **CRASH!** Explodiu tudo mano, que azar! devia ter parado antes.")
        .setFooter({ text: `Chars restantes: ${Number(updatedUser.charLeft).toLocaleString()}` })
        .spliceFields(0, 3,
          { name: "Resultado",         value: `**- ${aposta.toLocaleString()} chars**`,                              inline: false },
          { name: "💰 Saldo Atual",    value: `**${Number(updatedUser.charLeft).toLocaleString()} chars**`,          inline: true  },
          { name: "💥 Crashou em",     value: `**${crashMultiplier.toFixed(1)}x**`,                                  inline: true  },
          { name: "🏆 Máximo Possível",value: `**${maxPayout.toLocaleString()} chars** (+${maxLucro.toLocaleString()})`, inline: true }
        );

      await msg.edit({ embeds: [embed], components: [] });
      return;
    }

    multiplier += 0.10;

    const lucroAtual = Math.floor(aposta * multiplier) - aposta;

    if (!gameActive) return;

    embed.spliceFields(0, 3,
      { name: "Multiplier", value: `**${multiplier.toFixed(1)}x**`, inline: true },
      { name: "Lucro Atual", value: `**+${lucroAtual.toLocaleString()}** chars`, inline: true },
      { name: "Aposta", value: `${aposta.toLocaleString()} chars`, inline: true }
    );

    await msg.edit({ embeds: [embed], components: [row] });
  }, 1000);

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

    await i.deferUpdate();

    const lucroFinal = Math.floor(aposta * multiplier) - aposta;
    const totalRecebido = aposta + lucroFinal;

    addChars(userId, guildId, totalRecebido);
    addUserPropertyByAmount("tiger_plays", userId, guildId, 1);
    addUserPropertyByAmount("tiger_wins", userId, guildId, 1);

    const updatedUser = getOrCreateUser(userId, displayName, guildId);

    embed
      .setColor("#00ff00")
      .setDescription(`✅ **PAROU NA HORA CERTA, PORRA!**\nParou em **${multiplier.toFixed(1)}x** e levou **${totalRecebido.toLocaleString()} chars**!`)
      .setFooter({ text: `Chars restantes: ${Number(updatedUser.charLeft).toLocaleString()}` })
      .spliceFields(0, 3,
        { name: "Resultado",          value: `**+${lucroFinal.toLocaleString()} chars**`,                               inline: false },
        { name: "💰 Saldo Atual",     value: `**${Number(updatedUser.charLeft).toLocaleString()} chars**`,              inline: true  },
        { name: "💥 Crasharia em",    value: `**${crashMultiplier.toFixed(1)}x**`,                                      inline: true  },
        { name: "🏆 Máximo Possível", value: `**${maxPayout.toLocaleString()} chars** (+${maxLucro.toLocaleString()})`, inline: true  }
      );

    const disableRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`crash_stop_${userId}`)
        .setEmoji("🛑")
        .setLabel("PARADO")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true)
    );

    await msg.edit({ embeds: [embed], components: [disableRow] });
  });

  collector.on("end", async (collected, reason) => {
    if (reason !== "time" || !gameActive) return;

    gameActive = false;
    clearInterval(gameInterval);

    addUserPropertyByAmount("tiger_plays", userId, guildId, 1);
    addUserPropertyByAmount("tiger_losses", userId, guildId, 1);

    const updatedUser = getOrCreateUser(userId, displayName, guildId);

    embed
      .setColor("#000000")
      .setDescription("⏰ **Tempo esgotado!** Você demorou demais pra parar e o crash te pegou.")
      .setFooter({ text: `Chars restantes: ${Number(updatedUser.charLeft).toLocaleString()}` })
      .spliceFields(0, 3,
        { name: "Resultado",          value: `**- ${aposta.toLocaleString()} chars**`,                                  inline: false },
        { name: "💰 Saldo Atual",     value: `**${Number(updatedUser.charLeft).toLocaleString()} chars**`,              inline: true  },
        { name: "💥 Crashou em",      value: `**${crashMultiplier.toFixed(1)}x**`,                                      inline: true  },
        { name: "🏆 Máximo Possível", value: `**${maxPayout.toLocaleString()} chars** (+${maxLucro.toLocaleString()})`, inline: true  }
      );

    await msg.edit({ embeds: [embed], components: [] });
  });
}