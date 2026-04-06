import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getOrCreateUser, getUser, reduceChars, addChars, db } from "../database.js";
import { getClassModifier } from "../functions/classes.js";
import { awardAchievementInCommand } from "../functions/achievements.js";

export const name = "tigre";

const TIGRE_CUSTO = 350;
const TIGRE_LIMITE_DIARIO = 3;

export const data = new SlashCommandBuilder()
  .setName("tigre")
  .setDescription(`Aposta no tigre (até ${TIGRE_LIMITE_DIARIO}x por dia, custa ${TIGRE_CUSTO} chars).`);

export async function execute(client, data) {
  const userId = data.userId;
  const guildId = data.guildId;
  const displayName = data.displayName;
  const user = getOrCreateUser(userId, displayName, guildId);


  if (user.charLeft < TIGRE_CUSTO) {
    return data.reply(`❌ Você precisa de pelo menos ${TIGRE_CUSTO} caracteres para apostar no tigre!`);
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const sameDay = (user.tiger_spin_date || "") === todayKey;
  const spinsToday = sameDay ? (user.tiger_spins_count ?? 0) : 0;

  if (spinsToday >= TIGRE_LIMITE_DIARIO) {
    return data.reply(
      `Só pode apostar no tigre **${TIGRE_LIMITE_DIARIO}x** por dia fi! Volta amanhã.`
    );
  }

  const pendingStacks = Math.max(0, Math.min(8, Number(user.tiger_pending_double) || 0));
  const doubleMult = 2 ** pendingStacks;

  reduceChars(userId, guildId, TIGRE_CUSTO);

  const outcomes = [
    {
      type: "loss",
      chance: 0.65,
      amount: Math.floor(Math.random() * 1701) + 300,
      emoji: "💸",
      desc: "Perdeu",
    },
    {
      type: "win",
      chance: 0.25,
      amount: Math.floor(Math.random() * 1501) + 1000,
      emoji: "💰",
      desc: "Ganhou",
    },
    {
      type: "double",
      chance: 0.09,
      amount: 0,
      emoji: "🔄",
      desc: "Próximo resultado dobrado!",
    },
    {
      type: "jackpot",
      chance: 0.01,
      amount: Math.floor(Math.random() * 20001) + 5000,
      emoji: "🎰",
      desc: "JACKPOT!",
    },
  ];

  const classLucky = getClassModifier(user.user_class || "none", "lucky");
  const LUCK_WEIGHT = 0.1;
  const adjustedOutcomes = outcomes.map((outcome) => {
    const modifier =
      outcome.type === "loss"
        ? 1 - classLucky * LUCK_WEIGHT
        : 1 + classLucky * LUCK_WEIGHT;
    return { ...outcome, chance: outcome.chance * modifier };
  });

  const totalChance = adjustedOutcomes.reduce((sum, o) => sum + o.chance, 0);
  let cumulativeChance = 0;
  const random = Math.random();
  let selectedOutcome;

  for (const outcome of adjustedOutcomes) {
    cumulativeChance += outcome.chance / totalChance;
    if (random <= cumulativeChance) {
      selectedOutcome = outcome;
      break;
    }
  }

  if (!selectedOutcome) selectedOutcome = adjustedOutcomes[0];

  const spinsLeft = TIGRE_LIMITE_DIARIO - (spinsToday + 1);
  const spinsLeftMsg =
    spinsLeft > 0
      ? ` (${spinsLeft} rodada(s) restantes hoje)`
      : " (última rodada hoje)";

  let newPending = pendingStacks;
  let jackpotInc = 0;
  let extraMultLine = "";

  if (doubleMult > 1 && (selectedOutcome.type === "win" || selectedOutcome.type === "jackpot")) {
    extraMultLine = `\n✨ **×${doubleMult}** do acúmulo “resultado dobrado” aplicado nesta vitória!`;
  }

  let resultMessage = "";

  if (selectedOutcome.type === "loss") {
    const aviso =
      spinsLeft > 0
        ? ` Ainda dá **${spinsLeft}** rodada(s) hoje.`
        : " Acabaram as rodadas de hoje.";
    const keepDouble =
      pendingStacks > 0
        ? `\n🔄 Seu bônus de dobro continua valendo na próxima rodada que der win/jackpot.`
        : "";
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc}!** Foram **${TIGRE_CUSTO}** chars de aposta pro bolso da casa.${aviso}${keepDouble}`;
  } else if (selectedOutcome.type === "win") {
    const raw = selectedOutcome.amount;
    const payout = raw * doubleMult;
    addChars(userId, guildId, payout);
    newPending = 0;
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc} ${payout} caracteres!**\n🎉 O TIGRE TA PAGANDO!!!!!!${spinsLeftMsg}${extraMultLine}`;
  } else if (selectedOutcome.type === "jackpot") {
    const raw = selectedOutcome.amount;
    const payout = raw * doubleMult;
    addChars(userId, guildId, payout);
    newPending = 0;
    jackpotInc = 1;
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc} +${payout} caracteres!!**\n🚨🚨 JACKPOT CAIU! RESENHA COMEÇOU!!! 🚨🚨${spinsLeftMsg}${extraMultLine}`;
  } else if (selectedOutcome.type === "double") {
    newPending = Math.min(8, pendingStacks + 1);
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc}**\nAcúmulo de dobro: **×${2 ** newPending}** na próxima vitória (win ou jackpot).${spinsLeftMsg}`;
  }

  
  const baseLuckDelta =
    selectedOutcome.type === "loss"
      ? 2
      : selectedOutcome.type === "jackpot"
        ? -5
        : selectedOutcome.type === "win"
          ? -1
          : 0;

  const luckDelta = baseLuckDelta + Math.round(baseLuckDelta * classLucky * 0.15);
  const newLuck = (user.luck_stat || 0) + luckDelta;

  db.prepare(
    `
    UPDATE users
    SET tiger_spins_count = ?,
        tiger_spin_date = ?,
        luck_stat = ?,
        tiger_pending_double = ?,
        lifetime_tiger_spins = COALESCE(lifetime_tiger_spins, 0) + 1,
        tiger_jackpots = COALESCE(tiger_jackpots, 0) + ?
    WHERE id = ? AND guild_id = ?
  `
  ).run(
    spinsToday + 1,
    todayKey,
    newLuck,
    newPending,
    jackpotInc,
    userId,
    guildId
  );

  await awardAchievementInCommand(client, data, "tigrinho_lenda");
  await awardAchievementInCommand(client, data, "tigre_centuria");

  const saldoFinal = getUser(userId, guildId)?.charLeft ?? 0;

  const embedColor =
    selectedOutcome.type === "jackpot"
      ? "#FFD700"
      : selectedOutcome.type === "loss"
        ? "#FF6B6B"
        : "#4ECDC4";

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle("🎰 Tigrinho da YuiMizuno 🎰")
    .setDescription(`
${resultMessage}

**📊 Estatísticas:**
• **Caracteres atuais:** ${saldoFinal}
• **Custo da rodada:** ${TIGRE_CUSTO} chars (prêmios de vitória são **líquidos**, além desse custo)
• **Sorte acumulada:** ${newLuck > 0 ? "+" : ""}${newLuck}
• **Dobro pendente (próxima vitória):** ${newPending > 0 ? `×${2 ** newPending}` : "nenhum"}
    `)
    .setFooter({ text: `Tigrinho é agro tigrinho é pop ` });

  return data.reply({ embeds: [embed] });
}
