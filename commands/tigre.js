import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getOrCreateUser, getUser, reduceChars, addChars, db } from "../database.js";
import { getClassModifier } from "../functions/classes.js";

export const name = "tigre";

const TIGRE_CUSTO = 500;
const TIGRE_LIMITE_DIARIO = 3;

export const data = new SlashCommandBuilder()
  .setName("tigre")
  .setDescription(`Aposta no tigre (até ${TIGRE_LIMITE_DIARIO}x por dia, custa ${TIGRE_CUSTO} chars).`);

function parseArgs(data) {
  // No args for tigre
  return {};
}

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

  reduceChars(userId, guildId, TIGRE_CUSTO);

const outcomes = [
  { 
    chance: 0.65, 
    multiplier: -1, 
    amount: Math.floor(Math.random() * 1701) + 300,
    emoji: "💸", 
    desc: "Perdeu" 
  },
  {
    chance: 0.25,
    multiplier: 1,
    amount: Math.floor(Math.random() * 1501) + 1000,
    emoji: "💰",
    desc: "Ganhou",
  },
  { 
    chance: 0.09, 
    multiplier: 2, 
    amount: 0, 
    emoji: "🔄", 
    desc: "Próximo roubo dobrado!" 
  },
  {
    chance: 0.01,
    multiplier: 1,
    amount: Math.floor(Math.random() * 20001) + 5000, 
    emoji: "🎰",
    desc: "JACKPOT!",
  },
];
  const classLucky = getClassModifier(user.user_class || 'none', 'lucky');
  const adjustedOutcomes = outcomes.map(outcome => {
    const modifier = outcome.multiplier >= 1 ? 1 + classLucky : 1 - classLucky;
    return { ...outcome, chance: outcome.chance * modifier };
  });

  let selectedOutcome;
  const totalChance = adjustedOutcomes.reduce((sum, outcome) => sum + outcome.chance, 0);
  let cumulativeChance = 0;
  const random = Math.random();

  for (const outcome of adjustedOutcomes) {
    cumulativeChance += outcome.chance / totalChance;
    if (random <= cumulativeChance) {
      selectedOutcome = outcome;
      break;
    }
  }

  let finalAmount = selectedOutcome.amount;
  let resultMessage = "";

  if (selectedOutcome.multiplier === -1) {
    const restantes = TIGRE_LIMITE_DIARIO - (spinsToday + 1);
    const aviso =
      restantes > 0
        ? ` Ainda dá **${restantes}** rodada(s) hoje.`
        : " Acabaram as rodadas de hoje (UTC).";
    resultMessage =
      `${selectedOutcome.emoji} **${selectedOutcome.desc}!** Foram **${TIGRE_CUSTO}** chars de aposta pro bolso da casa.${aviso}`;
  } else if (selectedOutcome.multiplier === 1) {
    addChars(userId, guildId, finalAmount);
    const restantes = TIGRE_LIMITE_DIARIO - (spinsToday + 1);
    const extra = restantes > 0 ? ` (${restantes} rodada(s) restantes hoje)` : " (última rodada hoje)";
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc} ${finalAmount} caracteres!**\n🎉 O TIGRE TA PAGANDO!!!!!!${extra}`;
  } else if (selectedOutcome.multiplier === 2) {
    const restantes = TIGRE_LIMITE_DIARIO - (spinsToday + 1);
    const extra = restantes > 0 ? ` (${restantes} rodada(s) restantes hoje)` : " (última rodada hoje)";
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc}**\nNão ganhou caractere, voce ganhou o dobro de chance no proximo roubo!${extra}`;
  }

  let luckChange = 0;
  if (selectedOutcome.multiplier === -1) {
    luckChange = -1;
  } else if (selectedOutcome.multiplier === 1) {
    luckChange = 1;
  } else {
    luckChange = 5;
  }

  const adjustedLuckChange = Math.round(luckChange * (1 + classLucky));

  // Update user stats ((move this to database.js later))
  const newLuck = (user.luck_stat || 0) + adjustedLuckChange;
  const updateStmt = db.prepare(`
    UPDATE users
    SET tiger_spins_count = ?, tiger_spin_date = ?, luck_stat = ?
    WHERE id = ? AND guild_id = ?
  `);
  updateStmt.run(spinsToday + 1, todayKey, newLuck, userId, guildId);

  const saldoFinal = getUser(userId, guildId)?.charLeft ?? 0;

  const embed = new EmbedBuilder()
    .setColor(selectedOutcome.multiplier === -1 ? "#FF6B6B" : "#4ECDC4")
    .setTitle("🎰 Tigrinho da YuiMizuno 🎰")
    .setDescription(`
${resultMessage}

**📊 Estatísticas:**
• **Caracteres atuais:** ${saldoFinal}
• **Custo da rodada:** ${TIGRE_CUSTO} chars (prêmios de vitória são **líquidos**, além desse custo)
• **Sorte atual:** ${newLuck > 0 ? "+" : ""}${newLuck}
    `)
    .setFooter({ text: "Tigrinho é agro tigrinho é pop" });

  return data.reply({ embeds: [embed] });
}