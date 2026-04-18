import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { 
  getOrCreateUser, 
  addChars, 
  reduceChars,
  getSpendableChars,
  addUserPropertyByAmount,
  getServerConfig 
} from "../database.js";
import { getClassModifier } from "../functions/classes.js";
import { awardAchievementInCommand } from "../functions/achievements.js";
import { getCurrentDailyEvent } from "../functions/getTodaysEvent.js";

export const name = "crash";
export const aliases = ["crashgame", "cg", "aviaozinho"];
export const requiresCharLimit = true;

// ========== CONFIGURAÇÕES DO CRASH ==========
const LUCK_FACTOR = 1.0;      
const EVENT_FIELD = 'crashBonus'

const BASE_WEIGHTS = {
  low:    1.00,   // ≤1.0x (steps 2-6)
  medium: 1.85,   // 1.1x – 2.0x (steps 7-16)
  high:   0.45,   // 2.1x – 5.0x (steps 17-46)
  jackpot:0.08    // >5.0x (steps 47-100)
};

const BIAS = {
  low:    2.0,
  medium: 1.8,
  high:   1.5,
  jackpot:1.2
};

function randomStepInRange(min, max, bias) {
  const range = max - min + 1;
  const u = Math.random();
  const index = Math.floor(Math.pow(u, bias) * range);
  return min + index;
}

async function generateCrashStep(lucky, guildId) {
  let eventFactor = 1.0;
  const event = await getCurrentDailyEvent(guildId);
  if (event && typeof event[EVENT_FIELD] === 'number') {
    eventFactor = Math.max(0.5, Math.min(2.0, event[EVENT_FIELD])); // limites seguros
  }

  const luckyEffect = LUCK_FACTOR * lucky * 0.25;

  const weights = {
    low:    BASE_WEIGHTS.low    * (1 - luckyEffect) * (1 / eventFactor),
    medium: BASE_WEIGHTS.medium * (1 + luckyEffect) * eventFactor,
    high:   BASE_WEIGHTS.high   * (1 + luckyEffect) * eventFactor,
    jackpot:BASE_WEIGHTS.jackpot* (1 + luckyEffect) * eventFactor
  };

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const norm = {
    low:    weights.low    / total,
    medium: weights.medium / total,
    high:   weights.high   / total,
    jackpot:weights.jackpot/ total
  };

  const rand = Math.random();
  let cumulative = 0;
  let selectedFaixa;
  const faixas = ['low', 'medium', 'high', 'jackpot'];
  for (const f of faixas) {
    cumulative += norm[f];
    if (rand <= cumulative) {
      selectedFaixa = f;
      break;
    }
  }

  let step;
  switch (selectedFaixa) {
    case 'low':
      step = randomStepInRange(2, 6, BIAS.low);
      break;
    case 'medium':
      step = randomStepInRange(7, 16, BIAS.medium);
      break;
    case 'high':
      step = randomStepInRange(17, 46, BIAS.high);
      break;
    case 'jackpot':
      step = randomStepInRange(47, 100, BIAS.jackpot);
      break;
    default:
      step = 2;
  }
  return step;
}

export const data = new SlashCommandBuilder()
  .setName("crash")
  .setDescription("Aposte chars e tente parar o antes do crash! Quanto mais sobe maior o risco e a recompensa!")
  .addNumberOption(option =>
    option
      .setName("aposta")
      .setDescription("Quantidade de chars pra apostar (mín. 50)")
      .setRequired(true)
      .setMinValue(50)
  );

export async function execute(client, data) {
  const { userId, guildId, displayName, fromInteraction } = data;

  if (!getServerConfig(guildId, 'charLimitEnabled')) {
    return await data.reply("❌ O sistema de caracteres está desligado neste servidor!");
  }

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
  const spendableChars = await getSpendableChars(userId, guildId);

  if (aposta > spendableChars) {
    return await data.reply(`**${displayName}**, tu só tem **${charLeft.toLocaleString()}** chars${spendableChars > charLeft ? ` (+ ${(spendableChars - charLeft).toLocaleString()} de crédito)` : ''}. Aposta algo que tu tem, seu liso!`);
  }

  await reduceChars(userId, guildId, aposta, true);
  addUserPropertyByAmount("tiger_plays", userId, guildId, 1);

  const classLucky = getClassModifier(user.user_class, "lucky");

  const crashStep = await generateCrashStep(classLucky, guildId);

  const crashMultiplier = parseFloat((0.5 + (crashStep - 1) * 0.10).toFixed(1));
  const maxPayout       = Math.floor(aposta * crashMultiplier);
  const maxLucro        = maxPayout - aposta;

  let multiplier = 0.5;
  let step = 0;
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

    await addChars(userId, guildId, totalRecebido);
    await addUserPropertyByAmount("tiger_wins", userId, guildId, 1);

    const updatedUser = getOrCreateUser(userId, displayName, guildId);

    embed
      .setColor("#00ff00")
      .setDescription(`✅ **PAROU NA HORA CERTA, PORRA!**\nParou em **${multiplier.toFixed(1)}x** e levou **${lucroFinal.toLocaleString()} chars**!`)
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

  await awardAchievementInCommand(client, data, "tigrinho_lenda");
  await awardAchievementInCommand(client, data, "tigre_centuria"); 
  await awardAchievementInCommand(client, data, "apostador"); 
  await awardAchievementInCommand(client, data, "masoquista");  
  await awardAchievementInCommand(client, data, "sortudo_no_tigre");
  await awardAchievementInCommand(client, data, "tigreiro_nato");

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