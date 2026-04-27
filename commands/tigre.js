import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import {
  getOrCreateUser, getUser, reduceChars, addChars,
  getSpendableChars, addUserPropertyByAmount, setUserProperty, getServerConfig
} from "../database.js";
import { getClassModifier } from "../functions/classes.js";
import { awardAchievementInCommand } from "../functions/achievements.js";
import { randomInt } from 'es-toolkit';
import { getCurrentDailyEvent } from "../functions/getTodaysEvent.js";
import { customEmojis } from "../functions/utils.js";
import { getBankBalance } from "../functions/database/bank.js";

export const name = "tigre";
export const aliases = ["tigrinho", "casino", "slot", "slots", "apostar"];
export const requiresCharLimit = true;

const LOADING_TIME = 2200;

const LUCK_WEIGHT         = 0.25; 
const WEALTH_THRESHOLD    = 4000;  // saldo no banco a partir do qual penaliza
const WEALTH_PENALTY_CAP  = 0.20;  // penalidade máxima por riqueza
const STREAK_PENALTY_STEP = 0.04;  // penalidade por vitória consecutiva
const MAX_STREAK_PENALTY  = 0.25;  // cap do streak


const MODES = {
  cobra: {
    key: "cobra",
    emoji: "🐍",
    label: "🐍 Cobra da Sorte",
    cost: 50,
    color: "#2ECC71",
    style: ButtonStyle.Success,
    getOutcomes: () => [
      { type: "loss",      chance: 0.520, amount: 0,                    emoji: "💸", desc: "Perdeu" },
      { type: "small_win", chance: 0.250, amount: randomInt(2, 41),    emoji: "🪙", desc: "Migalhas" },
      { type: "win",       chance: 0.120, amount: randomInt(51, 221),   emoji: "💰", desc: "Ganhou" },
      { type: "double",    chance: 0.050, amount: 0,                    emoji: "🔄", desc: "Próximo resultado dobrado!" },
      { type: "revanche",  chance: 0.030, amount: 0,                    emoji: "🔁", desc: "Revanche!" },
      { type: "jackpot",   chance: 0.005, amount: randomInt(800, 3001), emoji: "🎰", desc: "JACKPOT!" },
    ],
  },
  dragao: {
    key: "dragao",
    emoji: "🐉",
    label: "🐉 Dragão da Fortuna",
    cost: 250,
    color: "#9B59B6",
    style: ButtonStyle.Primary,
    getOutcomes: () => [
      { type: "loss",      chance: 0.530, amount: 0,                       emoji: "💸", desc: "Perdeu" },
      { type: "small_win", chance: 0.230, amount: randomInt(50, 201),      emoji: "🪙", desc: "Migalhas" },
      { type: "win",       chance: 0.140, amount: randomInt(251, 1161),    emoji: "💰", desc: "Ganhou" },
      { type: "double",    chance: 0.060, amount: 0,                       emoji: "🔄", desc: "Próximo resultado dobrado!" },
      { type: "revanche",  chance: 0.030, amount: 0,                       emoji: "🔁", desc: "Revanche!" },
      { type: "jackpot",   chance: 0.004, amount: randomInt(4000, 16001),  emoji: "🎰", desc: "JACKPOT!" },
    ],
  },
  tigrinho: {
    key: "tigrinho",
    emoji: "🐯",
    label: "🐯 Tigrinho",
    cost: 400,
    color: "#F1C40F",
    style: ButtonStyle.Danger,
    getOutcomes: () => [
      { type: "loss",      chance: 0.520, amount: 0,                        emoji: "💸", desc: "Perdeu" },
      { type: "small_win", chance: 0.220, amount: randomInt(80, 301),       emoji: "🪙", desc: "Migalhas" },
      { type: "win",       chance: 0.160, amount: randomInt(450, 1501),     emoji: "💰", desc: "Ganhou" },
      { type: "double",    chance: 0.060, amount: 0,                        emoji: "🔄", desc: "Próximo resultado dobrado!" },
      { type: "revanche",  chance: 0.030, amount: 0,                        emoji: "🔁", desc: "Revanche!" },
      { type: "jackpot",   chance: 0.003, amount: randomInt(10000, 40001),  emoji: "🎰", desc: "JACKPOT!" },
    ],
  },
};

function buildButtons(spendableChars) {
  return new ActionRowBuilder().addComponents(
    ...Object.values(MODES).map(mode =>
      new ButtonBuilder()
        .setCustomId(mode.key)
        .setLabel(`${mode.emoji} ${mode.cost} chars`)
        .setStyle(mode.style)
        .setDisabled(spendableChars < mode.cost)
    )
  );
}

function calcEffectiveLuck(classLucky) {
  const sign = Math.sign(classLucky);
  return sign * Math.sqrt(Math.abs(classLucky)) * LUCK_WEIGHT;
}

function calcWealthPenalty(bankBalance) {
  if (bankBalance <= WEALTH_THRESHOLD) return 0;
  return Math.min(WEALTH_PENALTY_CAP, Math.log10(bankBalance / WEALTH_THRESHOLD) * 0.075);
}

function calcStreakPenalty(winStreak) {
  return Math.min(MAX_STREAK_PENALTY, winStreak * STREAK_PENALTY_STEP);
}

async function runGame(client, interactionData, btnInteraction, mode, selectionMsg) {
  const { userId, guildId, displayName } = interactionData;

  const currentChars = await getSpendableChars(userId, guildId);
  if (currentChars < mode.cost) {
    await btnInteraction.update({
      embeds: [
        new EmbedBuilder()
          .setColor("#FF6B6B")
          .setDescription(`❌ Você não tem chars suficientes para **${mode.label}**! Precisa de **${mode.cost}**.`),
      ],
      components: [],
    });
    return;
  }

  const user          = getOrCreateUser(userId, displayName, guildId);
  const pendingStacks = Math.max(0, Math.min(8, Number(user.tiger_pending_double) || 0));
  const doubleMult    = 2 ** pendingStacks;
  const winStreak     = Math.max(0, Number(user.tiger_win_streak) || 0);

  await reduceChars(userId, guildId, mode.cost, true);

  const loadingEmbed = new EmbedBuilder()
    .setColor(mode.color)
    .setTitle(`${customEmojis.loading} ${mode.label} — Apostando...`)
    .setDescription("A sorte está decidindo o resultado...")
    .setFooter({ text: "Contando os chars..." });

  await btnInteraction.update({ embeds: [loadingEmbed], components: [] });
  await new Promise(resolve => setTimeout(resolve, LOADING_TIME));

  // ── Modificadores ─────────────────────────────────────────────────────────
  const classLucky  = getClassModifier(user.user_class, "lucky");
  const luck        = calcEffectiveLuck(classLucky);

  const bankBalance = getBankBalance(userId, guildId);
  const richPenalty = luck > 0 ? calcWealthPenalty(bankBalance) : 0;
  const finalLuck   = luck > 0 ? Math.max(0, luck - richPenalty) : luck;

  const streak      = calcStreakPenalty(winStreak);

  const event       = await getCurrentDailyEvent(guildId);
  const successMult = event?.tigerSuccess ?? 1.0;

  let adjusted = mode.getOutcomes().map(outcome => {
    let chance = outcome.chance;

    switch (outcome.type) {
      case "loss":
        chance *= (1 - finalLuck) * (1 + streak);
        break;

      case "small_win":
      case "win":
      case "double":
      case "revanche":
        chance *= (1 + finalLuck) * (1 - streak);
        if (outcome.type === "win" && successMult !== 1.0) chance *= successMult;
        break;

      case "jackpot":
        chance *= (1 - streak * 0.5);
        if (successMult !== 1.0) chance *= successMult;
        break;
    }

    return { ...outcome, chance };
  });

  const total = adjusted.reduce((sum, o) => sum + o.chance, 0);
  adjusted    = adjusted.map(o => ({ ...o, chance: o.chance / total }));

  // Rolagem
  const rand = Math.random();
  let cumulative = 0;
  let selectedOutcome = adjusted[0];
  for (const outcome of adjusted) {
    cumulative += outcome.chance;
    if (rand <= cumulative) { selectedOutcome = outcome; break; }
  }

  let newPending  = pendingStacks;
  let newStreak   = winStreak;
  let jackpotInc  = 0, winsInc = 0, lossesInc = 0;
  let extraMultLine = "";
  let resultMessage = "";

  if (doubleMult > 1 && selectedOutcome.type === "win" || doubleMult > 1 && selectedOutcome.type === "jackpot") {
    extraMultLine = `\n💎 **×${doubleMult}** do acúmulo "resultado dobrado" aplicado nesta vitória!`;
  }

  if (selectedOutcome.type === "loss") {
    lossesInc = 1;
    newStreak  = 0;
    const keepDouble = pendingStacks > 0
      ? `\n🔄 Seu bônus de dobro continua valendo na próxima vitória.`
      : "";
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc}!** Foram **${mode.cost}** chars pro bolso da casa.${keepDouble}`;
  }
  else if (selectedOutcome.type === "small_win") {
    const payout = selectedOutcome.amount * doubleMult;
    await addChars(userId, guildId, payout);
    newPending = 0;
    newStreak  = winStreak + 1;
    winsInc    = 1;
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc} ${payout} caracteres!**\n🎉 O TIGRE TA PAGANDO!!!!!!${extraMultLine}`;
  }
  else if (selectedOutcome.type === "revanche") {
    await addChars(userId, guildId, mode.cost);
    resultMessage = `${selectedOutcome.emoji} **Revanche!** Você recuperou os **${mode.cost} chars** gastos nesta rodada!`;
  }
  else if (selectedOutcome.type === "win") {
    const payout = selectedOutcome.amount * doubleMult;
    await addChars(userId, guildId, payout);
    newPending = 0;
    newStreak  = winStreak + 1;
    winsInc    = 1;
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc} ${payout} caracteres!**\n🎉 O TIGRE TA PAGANDO!!!!!!${extraMultLine}`;
  }
  else if (selectedOutcome.type === "jackpot") {
    const payout = selectedOutcome.amount * doubleMult;
    await addChars(userId, guildId, payout);
    newPending = 0;
    newStreak  = winStreak + 1;
    jackpotInc = 1;
    winsInc    = 1;
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc} +${payout} caracteres!!**\n🚨🚨 JACKPOT CAIU! RESENHA COMEÇOU!!! 🚨🚨${extraMultLine}`;
  }
  else if (selectedOutcome.type === "double") {
    newPending = Math.min(8, pendingStacks + 1);
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc}**\nAcúmulo de dobro: **×${2 ** newPending}** na próxima vitória (win ou jackpot).`;
  }

  addUserPropertyByAmount("tiger_plays",    userId, guildId, 1);
  addUserPropertyByAmount("tiger_wins",     userId, guildId, winsInc);
  addUserPropertyByAmount("tiger_losses",   userId, guildId, lossesInc);
  addUserPropertyByAmount("tiger_jackpots", userId, guildId, jackpotInc);
  setUserProperty("tiger_pending_double",   userId, guildId, newPending);
  setUserProperty("tiger_win_streak",       userId, guildId, newStreak);

  await awardAchievementInCommand(client, interactionData, "tigrinho_lenda");
  await awardAchievementInCommand(client, interactionData, "tigre_centuria");
  await awardAchievementInCommand(client, interactionData, "apostador");
  await awardAchievementInCommand(client, interactionData, "masoquista");
  await awardAchievementInCommand(client, interactionData, "sortudo_no_tigre");
  await awardAchievementInCommand(client, interactionData, "tigreiro_nato");

  const saldoFinal       = getUser(userId, guildId)?.charLeft ?? 0;
  const currentSpendable = await getSpendableChars(userId, guildId);

  const embedColor =
    selectedOutcome.type === "jackpot"   ? "#FFD700" :
    selectedOutcome.type === "win"       ? "#4ECDC4" :
    selectedOutcome.type === "small_win" ? "#74AEB2" :
    selectedOutcome.type === "loss"      ? "#FF6B6B" : "#4ECDC4";

  const custoEfetivo = (() => {
    if (selectedOutcome.type === "revanche")  return `0 (devolvidos pela Revanche!)`;
    if (selectedOutcome.type === "small_win") return `${mode.cost - selectedOutcome.amount} (recuperou ${selectedOutcome.amount})`;
    if (selectedOutcome.type === "win" || selectedOutcome.type === "jackpot") return `0 (lucro!)`;
    return `${mode.cost}`;
  })();

  const resultEmbed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`🎰 ${mode.label}`)
    .setDescription(`
${resultMessage}

**📊 Estatísticas:**
- **Caracteres atuais:** ${saldoFinal}
- **Custo efetivo da rodada:** ${custoEfetivo} chars
- **Dobro pendente (próxima vitória):** ${newPending > 0 ? `×${2 ** newPending}` : "nenhum"}
    `)
    .setFooter({ text: "Vicio em apostas é paia!" });

  await selectionMsg.edit({ embeds: [resultEmbed], components: [buildButtons(currentSpendable)] });
}

export async function execute(client, data) {
  const userId      = data.userId;
  const guildId     = data.guildId;
  const displayName = data.displayName;

  if (!getServerConfig(guildId, 'charLimitEnabled')) {
    return await data.reply("❌ O sistema de caracteres está desligado neste servidor!");
  }

  getOrCreateUser(userId, displayName, guildId);

  const spendableChars = await getSpendableChars(userId, guildId);
  if (spendableChars < MODES.cobra.cost) {
    return data.reply(
      `❌ Você precisa de pelo menos **${MODES.cobra.cost}** chars para apostar (modo mais barato: 🐍 Cobra da Sorte).`
    );
  }

  const selectionEmbed = new EmbedBuilder()
    .setColor("#F1C40F")
    .setTitle("🎰 Cassino — Escolha sua aposta!")
    .setDescription([
      `${customEmojis.lapislazuli} **Seus chars disponíveis:** ${spendableChars}`,
      "",
      `**🐍 Cobra da Sorte** — \`50 chars\``,
      `Tens oque é necessario para domar a cobra? • Jackpot: 800–3.000`,
      "",
      `**🐉 Dragão da Fortuna** — \`250 chars\``,
      `O Dragão é justo, imparcial e impiedoso • Jackpot: 4.000–16.000`,
      "",
      `**🐯 Tigrinho** — \`400 chars\``,
      `O verdadeiro tigrinho! jogue nos horarios bugados • Jackpot: 10.000–40.000`,
    ].join("\n"))
    .setFooter({ text: "escolha com sabedoria!" });

  const selectionMsg = await data.reply({
    embeds: [selectionEmbed],
    components: [buildButtons(spendableChars)],
    withResponse: true,
  });

  const collector = selectionMsg.createMessageComponentCollector({
    filter: i => i.user.id === userId,
    time: 120_000,
  });

  collector.on("collect", async (btnInteraction) => {
    const mode = MODES[btnInteraction.customId];
    if (!mode) return;
    await runGame(client, data, btnInteraction, mode, selectionMsg);
  });

  collector.on("end", async () => {
    await selectionMsg.edit({ components: [] }).catch(() => {});
  });
}