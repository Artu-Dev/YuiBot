import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getOrCreateUser, getUser, reduceChars, addChars, db, addUserPropertyByAmount, getServerConfig } from "../database.js";
import { getClassModifier } from "../functions/classes.js";
import { awardAchievementInCommand } from "../functions/achievements.js";
import { randomInt } from 'es-toolkit';
import { getCurrentDailyEvent } from "../functions/getTodaysEvent.js";

export const name = "tigre";
export const aliases = ["tigrinho", "casino", "slot", "slots", "apostar"];
export const requiresCharLimit = true;

const TIGRE_CUSTO = 350;
let TIGRE_SUCCESS_MULTIPLIER = 1.0;

export const data = new SlashCommandBuilder()
  .setName("tigre")
  .setDescription(`Aposta no tigre. Prêmios variam de 200 a 25.000 chars`);

export async function execute(client, data) {
  const userId = data.userId;
  const guildId = data.guildId;
  const displayName = data.displayName;
  
  if (!getServerConfig(guildId, 'charLimitEnabled')) {
    return await data.reply("❌ O sistema de caracteres está desligado neste servidor!");
  }

  const user = getOrCreateUser(userId, displayName, guildId);

  if (user.charLeft < TIGRE_CUSTO) {
    return data.reply(`❌ Você precisa de pelo menos ${TIGRE_CUSTO} caracteres para apostar no tigre!`);
  }

  const pendingStacks = Math.max(0, Math.min(8, Number(user.tiger_pending_double) || 0));
  const doubleMult = 2 ** pendingStacks;

  reduceChars(userId, guildId, TIGRE_CUSTO);

  const outcomes = [
    { type: "loss",    chance: 0.65, amount: 0,                        emoji: "💸", desc: "Perdeu" },
    { type: "win",     chance: 0.25, amount: randomInt(200, 2501),      emoji: "💰", desc: "Ganhou" },
    { type: "double",  chance: 0.09, amount: 0,                        emoji: "🔄", desc: "Próximo resultado dobrado!" },
    { type: "jackpot", chance: 0.01, amount: randomInt(5000, 25001),    emoji: "🎰", desc: "JACKPOT!" },
  ];

  const classLucky = getClassModifier(user.user_class, "lucky");
  const LUCK_WEIGHT = 0.40;
  const event = await getCurrentDailyEvent(guildId);
  const successMult = event?.tigerSuccess ?? 1.0; 

  let adjusted = outcomes.map(outcome => {
    let chance = outcome.baseChance;
    if (outcome.type === "loss") {
      chance *= (1 - classLucky * LUCK_WEIGHT);
    } else {
      chance *= (1 + classLucky * LUCK_WEIGHT);
    }
    if ((outcome.type === "win" || outcome.type === "jackpot") && successMult !== 1.0) {
      chance *= successMult;
    }

    return { ...outcome, chance };
  });

  const total = adjusted.reduce((sum, o) => sum + o.chance, 0);
  adjusted = adjusted.map(o => ({ ...o, chance: o.chance / total }));

  // const adjustedOutcomes = outcomes.map((outcome) => {
  //   const modifier = outcome.type === "loss"
  //     ? 1 - classLucky * LUCK_WEIGHT
  //     : 1 + classLucky * LUCK_WEIGHT;
  //   return { ...outcome, chance: outcome.chance * modifier };
  // });
  // const totalChance = adjustedOutcomes.reduce((sum, o) => sum + o.chance, 0);




  const rand = Math.random();
  let cumulativeChance = 0;
  let selectedOutcome = null;
  
  if (event && event.tigerSuccess !== null) {
    TIGRE_SUCCESS_MULTIPLIER = event.tigerSuccess;
  }

  for (const outcome of adjusted) {
    cumulativeChance += outcome.chance;
    if (rand <= cumulativeChance) {
      selectedOutcome = outcome;
      break;
    }
  }

  // for (const outcome of adjustedOutcomes) {
  //   if(outcome.type === "win" || outcome.type === "jackpot") {
  //     outcome.chance *= TIGRE_SUCCESS_MULTIPLIER;
  //   }
  //   cumulativeChance += outcome.chance / totalChance;
  //   if (rand <= cumulativeChance) {
  //     selectedOutcome = outcome;
  //     break;
  //   }
  // }

  // if (!selectedOutcome) selectedOutcome = adjustedOutcomes[0];
  if (!selectedOutcome) selectedOutcome = adjusted[0];

  let newPending = pendingStacks;
  let jackpotInc = 0;
  let winsInc = 0;
  let lossesInc = 0;
  let extraMultLine = "";

  if (doubleMult > 1 && (selectedOutcome.type === "win" || selectedOutcome.type === "jackpot")) {
    extraMultLine = `\n💎 **×${doubleMult}** do acúmulo “resultado dobrado” aplicado nesta vitória!`;
  }

  let resultMessage = "";

  if (selectedOutcome.type === "loss") {
    lossesInc = 1;
    const keepDouble = pendingStacks > 0
      ? `\n🔄 Seu bônus de dobro continua valendo na próxima rodada que der win/jackpot.`
      : "";
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc}!** Foram **${TIGRE_CUSTO}** chars de aposta pro bolso da casa.${keepDouble}`;
  } else if (selectedOutcome.type === "win") {
    const payout = selectedOutcome.amount * doubleMult;
    addChars(userId, guildId, payout);
    newPending = 0;
    winsInc = 1;
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc} ${payout} caracteres!**\n🎉 O TIGRE TA PAGANDO!!!!!!${extraMultLine}`;
  } else if (selectedOutcome.type === "jackpot") {
    const payout = selectedOutcome.amount * doubleMult;
    addChars(userId, guildId, payout);
    newPending = 0;
    jackpotInc = 1;
    winsInc = 1;
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc} +${payout} caracteres!!**\n🚨🚨 JACKPOT CAIU! RESENHA COMEÇOU!!! 🚨🚨${extraMultLine}`;
  } else if (selectedOutcome.type === "double") {
    newPending = Math.min(8, pendingStacks + 1);
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc}**\nAcúmulo de dobro: **×${2 ** newPending}** na próxima vitória (win ou jackpot).`;
  }

  addUserPropertyByAmount("tiger_plays", userId, guildId, 1);
  addUserPropertyByAmount("tiger_wins", userId, guildId, winsInc);
  addUserPropertyByAmount("tiger_losses", userId, guildId, lossesInc);
  addUserPropertyByAmount("tiger_jackpots", userId, guildId, jackpotInc);
  addUserPropertyByAmount("tiger_pending_double", userId, guildId, newPending);

  // ── Conquistas ───────────────────────────────────────────────────────────────
  await awardAchievementInCommand(client, data, "tigrinho_lenda");
  await awardAchievementInCommand(client, data, "tigre_centuria"); 
  await awardAchievementInCommand(client, data, "apostador"); 
  await awardAchievementInCommand(client, data, "masoquista");  
  await awardAchievementInCommand(client, data, "sortudo_no_tigre");
  await awardAchievementInCommand(client, data, "tigreiro_nato");

  const saldoFinal = await getUser(userId, guildId)?.charLeft ?? 0;

  const embedColor =
    selectedOutcome.type === "jackpot" ? "#FFD700" :
    selectedOutcome.type === "loss"    ? "#FF6B6B" : "#4ECDC4";

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle("🎰 Tigrinho da YuiMizuno 🎰")
    .setDescription(`
${resultMessage}

**📊 Estatísticas:**
• **Caracteres atuais:** ${saldoFinal}
• **Custo da rodada:** ${TIGRE_CUSTO} chars
• **Dobro pendente (próxima vitória):** ${newPending > 0 ? `×${2 ** newPending}` : "nenhum"}
    `)
    .setFooter({ text: `Tigrinho é agro tigrinho é pop` });

  return data.reply({ embeds: [embed] });
}