import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { getOrCreateUser, getUser, reduceChars, addChars, getSpendableChars, addUserPropertyByAmount, setUserProperty, getServerConfig } from "../database.js";
import { getClassModifier } from "../functions/classes.js";
import { awardAchievementInCommand } from "../functions/achievements.js";
import { randomInt } from 'es-toolkit';
import { getCurrentDailyEvent } from "../functions/getTodaysEvent.js";
import { customEmojis } from "../functions/utils.js";

export const name = "tigre";
export const aliases = ["tigrinho", "casino", "slot", "slots", "apostar"];
export const requiresCharLimit = true;

const LOADING_TIME = 2200;
const LUCK_WEIGHT = 0.40;

const MODES = {
  cobra: {
    key: "cobra",
    emoji: "🐍",
    label: "🐍 Cobra da Sorte",
    cost: 50,
    color: "#2ECC71",
    style: ButtonStyle.Success,
    getOutcomes: () => [
      { type: "loss",     chance: 0.82, amount: 0, emoji: "💸", desc: "Perdeu" },
      { type: "win",      chance: 0.09, amount: randomInt(100, 801), emoji: "💰", desc: "Ganhou" },
      { type: "double",   chance: 0.05, amount: 0, emoji: "🔄", desc: "Próximo resultado dobrado!" },
      { type: "jackpot",  chance: 0.01, amount: randomInt(2000, 8001), emoji: "🎰", desc: "JACKPOT!" },
      { type: "revanche", chance: 0.03, amount: 0, emoji: "🔁", desc: "Revanche!" },
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
      { type: "loss",     chance: 0.72, amount: 0, emoji: "💸", desc: "Perdeu" },
      { type: "win",      chance: 0.17, amount: randomInt(200, 2501), emoji: "💰", desc: "Ganhou" },
      { type: "double",   chance: 0.07, amount: 0, emoji: "🔄", desc: "Próximo resultado dobrado!" },
      { type: "jackpot",  chance: 0.01, amount: randomInt(5000, 25001), emoji: "🎰", desc: "JACKPOT!" },
      { type: "revanche", chance: 0.03, amount: 0, emoji: "🔁", desc: "Revanche!" },
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
      { type: "loss",     chance: 0.58, amount: 0, emoji: "💸", desc: "Perdeu" },
      { type: "win",      chance: 0.29, amount: randomInt(400, 4001), emoji: "💰", desc: "Ganhou" },
      { type: "double",   chance: 0.07, amount: 0, emoji: "🔄", desc: "Próximo resultado dobrado!" },
      { type: "jackpot",  chance: 0.02, amount: randomInt(10000, 50001), emoji: "🎰", desc: "JACKPOT!" },
      { type: "revanche", chance: 0.04, amount: 0, emoji: "🔁", desc: "Revanche!" },
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

  const user = getOrCreateUser(userId, displayName, guildId);
  const pendingStacks = Math.max(0, Math.min(8, Number(user.tiger_pending_double) || 0));
  const doubleMult = 2 ** pendingStacks;

  // Sempre cobra primeiro
  await reduceChars(userId, guildId, mode.cost, true);

  const loadingEmbed = new EmbedBuilder()
    .setColor(mode.color)
    .setTitle(`${customEmojis.loading} ${mode.label} — Apostando...`)
    .setDescription("A sorte está decidindo o resultado...")
    .setFooter({ text: "Contando os chars..." });

  await btnInteraction.update({ embeds: [loadingEmbed], components: [] });

  await new Promise(resolve => setTimeout(resolve, LOADING_TIME));

  const classLucky = getClassModifier(user.user_class, "lucky");
  const event = await getCurrentDailyEvent(guildId);
  const successMult = event?.tigerSuccess ?? 1.0;

  let adjusted = mode.getOutcomes().map(outcome => {
    let chance = outcome.chance;
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

  const rand = Math.random();
  let cumulativeChance = 0;
  let selectedOutcome = null;
  for (const outcome of adjusted) {
    cumulativeChance += outcome.chance;
    if (rand <= cumulativeChance) {
      selectedOutcome = outcome;
      break;
    }
  }
  if (!selectedOutcome) selectedOutcome = adjusted[0];

  let newPending = pendingStacks;
  let jackpotInc = 0, winsInc = 0, lossesInc = 0;
  let extraMultLine = "";
  let resultMessage = "";

  if (doubleMult > 1 && (selectedOutcome.type === "win" || selectedOutcome.type === "jackpot")) {
    extraMultLine = `\n💎 **×${doubleMult}** do acúmulo "resultado dobrado" aplicado nesta vitória!`;
  }

  if (selectedOutcome.type === "loss") {
    lossesInc = 1;
    const keepDouble = pendingStacks > 0
      ? `\n🔄 Seu bônus de dobro continua valendo na próxima rodada que der win/jackpot.`
      : "";
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc}!** Foram **${mode.cost}** chars de aposta pro bolso da casa.${keepDouble}`;
  } 
  else if (selectedOutcome.type === "revanche") {
    await addChars(userId, guildId, mode.cost); // devolve o que foi gasto
    resultMessage = `${selectedOutcome.emoji} **Revanche!** Você recuperou os **${mode.cost} chars** gastos nesta rodada!`;
    lossesInc = 0;
  } 
  else if (selectedOutcome.type === "win") {
    const payout = selectedOutcome.amount * doubleMult;
    await addChars(userId, guildId, payout);
    newPending = 0;
    winsInc = 1;
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc} ${payout} caracteres!**\n🎉 O TIGRE TA PAGANDO!!!!!!${extraMultLine}`;
  } 
  else if (selectedOutcome.type === "jackpot") {
    const payout = selectedOutcome.amount * doubleMult;
    await addChars(userId, guildId, payout);
    newPending = 0;
    jackpotInc = 1;
    winsInc = 1;
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc} +${payout} caracteres!!**\n🚨🚨 JACKPOT CAIU! RESENHA COMEÇOU!!! 🚨🚨${extraMultLine}`;
  } 
  else if (selectedOutcome.type === "double") {
    newPending = Math.min(8, pendingStacks + 1);
    resultMessage = `${selectedOutcome.emoji} **${selectedOutcome.desc}**\nAcúmulo de dobro: **×${2 ** newPending}** na próxima vitória (win ou jackpot).`;
  }

  addUserPropertyByAmount("tiger_plays", userId, guildId, 1);
  addUserPropertyByAmount("tiger_wins", userId, guildId, winsInc);
  addUserPropertyByAmount("tiger_losses", userId, guildId, lossesInc);
  addUserPropertyByAmount("tiger_jackpots", userId, guildId, jackpotInc);
  setUserProperty("tiger_pending_double", userId, guildId, newPending);

  await awardAchievementInCommand(client, interactionData, "tigrinho_lenda");
  await awardAchievementInCommand(client, interactionData, "tigre_centuria");
  await awardAchievementInCommand(client, interactionData, "apostador");
  await awardAchievementInCommand(client, interactionData, "masoquista");
  await awardAchievementInCommand(client, interactionData, "sortudo_no_tigre");
  await awardAchievementInCommand(client, interactionData, "tigreiro_nato");

  const saldoFinal = getUser(userId, guildId)?.charLeft ?? 0;
  const currentSpendable = await getSpendableChars(userId, guildId);

  const embedColor =
    selectedOutcome.type === "jackpot" ? "#FFD700" :
    selectedOutcome.type === "loss" ? "#FF6B6B" : "#4ECDC4";

  const resultEmbed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`🎰 ${mode.label}`)
    .setDescription(`
${resultMessage}

**📊 Estatísticas:**
• **Caracteres atuais:** ${saldoFinal}
• **Custo da rodada:** ${selectedOutcome.type === "revanche" ? `0 (devolvidos pela Revanche!)` : `${mode.cost}`} chars
• **Dobro pendente (próxima vitória):** ${newPending > 0 ? `×${2 ** newPending}` : "nenhum"}
    `)
    .setFooter({ text: "Vicio em apostas é paia!" });

  const components = [buildButtons(currentSpendable)];

  await selectionMsg.edit({ embeds: [resultEmbed], components });
}

export async function execute(client, data) {
  const userId = data.userId;
  const guildId = data.guildId;
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
      `Tens oque é necessario para domar a cobra? • Jackpot: 2.000–8.000`,
      "",
      `**🐉 Dragão da Fortuna** — \`250 chars\``,
      `O Dragão é justo e imparcial • Jackpot: 5.000–25.000`,
      "",
      `**🐯 Tigrinho** — \`400 chars\``,
      `O verdadeiro tigrinho! jogue nos horarios bugados • Jackpot: 10.000–50.000`,
    ].join("\n"))
    .setFooter({ text: "Após cada resultado os botões voltam automaticamente • Escolha o próximo modo sem usar /tigre" });

  const selectionMsg = await data.reply({
    embeds: [selectionEmbed],
    components: [buildButtons(spendableChars)],
    fetchReply: true,
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