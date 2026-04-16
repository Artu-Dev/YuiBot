import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import {
  addChars,
  addUserPropertyByAmount,
  getOrCreateUser,
  getRandomUserId,
  getUser,
  reduceChars,
  setUserProperty,
} from "../database.js";
import {
  applyClassModifier,
  getClassModifier,
} from "../functions/classes.js";
import { awardAchievementInCommand } from "../functions/achievements.js";
import { hasEffect, removeEffect } from "../functions/effects.js";
import { sample } from "es-toolkit";
import { getCurrentDailyEvent } from "../functions/getTodaysEvent.js";
import { customEmojis } from "../functions/utils.js";
import { isValidUserId, isValidGuildId } from "../functions/validation.js";  
// ==================== CONFIG ====================
const STEAL_PERCENTAGE_MIN = 0.05;
const STEAL_PERCENTAGE_MAX = 0.3;
const SUCCESS_CHANCE_TARGETED = 0.22;
const SUCCESS_CHANCE_RANDOM = 0.38;
const PENALTY_TARGETED = 150;
const PENALTY_RANDOM = 100;
const ROUBO_LIMIT_PER_DAY = 3;
const ROUBO_CHANCE_MULTIPLIER = 1.0;
const LOADING_TIME = 5000;

export const name = "roubar";
export const aliases = ["steal", "rob", "assaltar", "roubo"];

export const data = new SlashCommandBuilder()
  .setName("roubar")
  .setDescription(
    "Rouba caracteres de outro usuário (ou aleatório se não especificar).",
  )
  .addUserOption((option) =>
    option
      .setName("usuário")
      .setDescription(
        "O usuário para roubar (opcional, aleatório se não especificar)",
      )
      .setRequired(false),
  );

const loadingPhrases = {
  random: [
    "Amolando o facão pra peitar alguém aleatório...",
    "Olhando pros lados pra ver quem tá moscando...",
    "Correndo pelo servidor atrás de vítima fácil...",
    "Se infiltrando no meio da galera pra escolher o otário...",
    "Preparando o golpe do século em alguém aleatório...",
    "Afando a faca e escolhendo o próximo otário do dia...",
  ],
  targeted: [
    "Amolando o facão pra peitar <user>...",
    "Preparando o plano perfeito pra roubar <user>...",
    "Chegando de mansinho por trás de <user>...",
    "Marcando <user> como alvo principal...",
    "Mirando no <user> sem piedade...",
    "Aquecendo as mãos pra foder (nao sexualmente) <user>...",
  ],
};

function getRandomLoadingPhrase(isTargeted, victimName) {
  const list = isTargeted ? loadingPhrases.targeted : loadingPhrases.random;
  let phrase = sample(list);
  if (isTargeted) {
    phrase = phrase.replace("<user>", `**${victimName}**`);
  }
  return phrase;
}

function parseArgs(data) {
  if (data.fromInteraction) {
    return { mentionedUser: data.getUser("usuário") };
  }
  return { mentionedUser: data.mentionedUser };
}

export async function execute(client, data) {
  const { userId, guildId, displayName } = data;
  
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) {
    return data.reply("❌ Erro de configuração - IDs inválidos");
  }

  const { mentionedUser } = parseArgs(data);

  if (mentionedUser && !isValidUserId(mentionedUser.id)) {
    return data.reply("❌ Usuário mencionado inválido");
  }

  const now = new Date();
  const today = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

  const user = getOrCreateUser(userId, displayName, guildId);
  const userChars = Number(user.charLeft) || 0;

  const lastRouboDate = user.lastRoubo;
  let daily_robberies = Number(user.daily_robberies) || 0;

  if (lastRouboDate !== today) {
    setUserProperty("daily_robberies", userId, guildId, 1);
    setUserProperty("lastRoubo", userId, guildId, today);
    daily_robberies = 1;
  } else if (daily_robberies < ROUBO_LIMIT_PER_DAY) {
    addUserPropertyByAmount("daily_robberies", userId, guildId, 1);
    daily_robberies += 1;
  } else {
    return data.reply(
      `${customEmojis.pepeAngry} Tu já roubou alguém ${ROUBO_LIMIT_PER_DAY}x hoje, seu maldito!`,
    );
  }

  if (mentionedUser && mentionedUser.id === userId) {
    return data.reply(`${customEmojis.pepeCry} Você não pode roubar a si mesmo seu esquisito.`);
  }

  let victimId, victimData, victimName;
  const isTargeted = !!mentionedUser;

  if (isTargeted) {
    victimData = getUser(mentionedUser.id, guildId);
    if (!victimData)
      return data.reply(`${customEmojis.pepehmm} Esse usuário ainda não está no banco de dados.`);
    victimId = mentionedUser.id;
    victimName = victimData.display_name || mentionedUser.username;
  } else {
    victimId = getRandomUserId(guildId, userId);
    if (!victimId) return data.reply(`${customEmojis.poor} Não tem ninguém pra roubar no momento.`);
    victimData = getUser(victimId, guildId);
    victimName = victimData.display_name || "um usuário misterioso";
  }

  const victimChars = Number(victimData.charLeft) || 0;
  if (victimChars <= 0) {
    return data.reply(
      `${customEmojis.poor} ${displayName} tentou roubar ${victimName}, mas ele tá liso (0 chars).`,
    );
  }

  const loadingEmbed = new EmbedBuilder()
    .setColor("#751CA1")
    .setTitle(`${customEmojis.loading} Iniciando Roubo...`)
    .setDescription(getRandomLoadingPhrase(isTargeted, victimName))
    .setFooter({ text: "se preparando pra roubar..." });

  const loadingMsg = await data.reply({ embeds: [loadingEmbed] });

  await new Promise((resolve) => setTimeout(resolve, LOADING_TIME));


  const userRefresh = getOrCreateUser(userId, displayName, guildId);
  const userCharsRefresh = Number(userRefresh.charLeft) || 0;
  const victimDataRefresh = getUser(victimId, guildId);
  const victimCharsRefresh = Number(victimDataRefresh.charLeft) || 0;

  if (victimCharsRefresh <= 0) {
    return data.reply(`${customEmojis.poor} ${victimName} ficou sem chars enquanto você preparava o roubo!`);
  }

  const userClass = userRefresh.user_class || "none";
  const victimClass = victimDataRefresh.user_class || "none";
  const event = await getCurrentDailyEvent(guildId);

  let successChance = isTargeted
    ? SUCCESS_CHANCE_TARGETED
    : SUCCESS_CHANCE_RANDOM;
  successChance = applyClassModifier(
    successChance,
    isTargeted ? "singleRobSuccess" : "robSuccess",
    userClass,
  );
  successChance *= ROUBO_CHANCE_MULTIPLIER;

  if (event) {
    if (event.robSuccess !== null) successChance *= event.robSuccess;
    if (event.eventKey === "rob_100") successChance = 1.0;
    if (event.eventKey === "rob_0") successChance = 0.0;
  }

  // Check for guaranteed_rob effect (from Curso de Roubo item)
  if (hasEffect(userId, guildId, 'guaranteed_rob')) {
    successChance = 1.0;
    removeEffect(userId, guildId, 'guaranteed_rob');
  }

  const penalty = applyClassModifier(
    isTargeted ? PENALTY_TARGETED : PENALTY_RANDOM,
    "robCost",
    userClass,
  );
  const victimDefense = getClassModifier(victimClass, "robDefense");

  if (hasEffect(victimId, guildId, 'shield_robbery')) {
    return data.reply(`${customEmojis.shield} ${victimName} tinha um guarda costas MUITO foda! não da pra roubar alguem assim agora.`);
  }

  const baseStolen = Math.max(
    1,
    Math.floor(
      victimChars *
        (Math.random() * (STEAL_PERCENTAGE_MAX - STEAL_PERCENTAGE_MIN) +
          STEAL_PERCENTAGE_MIN),
    ),
  );
  
  let finalStolenAmount = baseStolen;
  let tookAll = false;
  
  if (hasEffect(userId, guildId, 'next_rob_takes_all')) {
    finalStolenAmount = victimChars; 
    tookAll = true;
    removeEffect(userId, guildId, 'next_rob_takes_all');
  }
  
  const stolenAmount = Math.max(
    1,
    Math.floor(
      finalStolenAmount *
        (1 + getClassModifier(userClass, "robDamage") - victimDefense),
    ),
  );

  // ====================== RESULTADO ======================
  const success = Math.random() < successChance;

  addUserPropertyByAmount("total_robberies", userId, guildId, 1);

  let finalReply = "";

  if (success) {
    addChars(userId, guildId, stolenAmount);
    reduceChars(victimId, guildId, stolenAmount);

    const successReplies = isTargeted
      ? [
          `${displayName} foi direto atrás de ${victimName} e conseguiu roubar ${stolenAmount} caracteres...`,
          `${displayName} foi sem dó em ${victimName} e saiu com ${stolenAmount} caracteres no cu, sem ser visto.`,
          `${displayName} sacou o brinquedo de furar moletom e pediu a ${victimName}, ${stolenAmount} caracteres, ele aceitou numa boa.`,
        ]
      : [
          `${displayName} roubou ${stolenAmount} caracteres de ${victimName} na covardia!`,
          `${victimName} moscou feiao e ${displayName} sem piedade alguma levou ${stolenAmount} chars de seu patrimonio.`,
          `${displayName} foi safado e roubou ${stolenAmount} caracteres de ${victimName}. (sem ele perceber rsrs)`,
        ];

    let allHint = "";
    if (tookAll) {
      allHint = `\n\n🔫 **PISTOLA DOURADA ATIVADA!** ${displayName} levou TODOS os caracteres de ${victimName}!`;
    }

    finalReply = sample(successReplies) + allHint;
  } else {
    if (userChars != 0) {
      reduceChars(userId, guildId, penalty);
      addChars(victimId, guildId, penalty);
    }

    setUserProperty("consecutive_robbery_losses", userId, guildId, 0);

    const failRepliesNoChars = isTargeted ? [
      `${displayName} tentou roubar ${victimName} e deu ruim pra caralho! Mas por sorte não tinha char nenhum pra perder kkk`,
      `${victimName} deu uma surra em ${displayName} e quase levou tudo... só não levou nada porque ${displayName} tava liso`,
      `${displayName} se fodeu tentando roubar ${victimName}, mas como não tinha char pra perder, saiu só na humilhação mesmo`,
    ] : [
      `${displayName} tentou roubar um aleatório e deu tudo errado! Ainda bem que não tinha char nenhum pra perder...`,
      `${displayName} quase doou chars sem querer pro ${victimName}, mas tava liso e não perdeu nada além da vergonha...`,
      `${displayName} foi tentar roubar alguém e se deu mal feio... por sorte não tinha char nenhum pra perder!`,
    ]


    const failReplies = isTargeted
      ? [
          `${displayName} tentou roubar ${victimName} na surdina... mas ${victimName} pegou com a mao na jaca. ${displayName} perdeu pra ele ${penalty} caracteres igual um betinha.`,
          `${victimName} estava paranoico com os cara no teto, viu ${displayName} chegando, pegou a makita e passou a mao em ${penalty} caracteres.`,
          `deu ruim menó! ${displayName} foi pego ao tentar roubar ${victimName} e teve que fazer um pix ${penalty} chars pra ele.`,
        ]
      : [
          `${displayName} foi roubar um aleatorio e se fodeu, foi pego no flagra e perdeu ${penalty} caracteres para ${victimName}!`,
          `${displayName} se deu mal na ação e acabou doando contra sua vontade ${penalty} caracteres para ${victimName}.`,
          `${displayName} foi burrao e acabou doando ${penalty} chars pra ${victimName} viva a benevolencia.`,
        ];

    finalReply = userChars === 0 ? sample(failRepliesNoChars) : sample(failReplies);
  }


  const finalChars = userChars + (success ? stolenAmount : -penalty);
  const resultEmbed = new EmbedBuilder()
    .setColor(success ? "#00FF00" : "#FF0000")
    .setTitle(success ? `${customEmojis.pointingGun} Roubo deu bom!` : `${customEmojis.pepeCry} Roubo deu B.O!`)
    .setDescription(finalReply)
    .setFooter({ text: `Total de chars: ${finalChars}` });

  await loadingMsg.edit({ embeds: [resultEmbed] });

  if (success && isTargeted) {
    const bountyValue = Number(victimData.total_bounty_value) || 0;
    const bountyPlacer = victimData.bounty_placer;

    if (bountyValue > 0 && bountyPlacer) {
      addChars(userId, guildId, bountyValue);
      addUserPropertyByAmount("bounties_claimed", userId, guildId, 1);

      setUserProperty("bounty_placer", victimId, guildId, null);
      setUserProperty("total_bounty_value", victimId, guildId, 0);

      await data.followUp(
        `${customEmojis.skullAndRoses} **Recompensa coletada!** ${displayName} pegou os **${bountyValue} chars** que estavam na cabeça de ${victimName}!`,
      );
    }
  }

  if (daily_robberies >= ROUBO_LIMIT_PER_DAY) {
      await data.followUp(`${customEmojis.pepeAngry} Você atingiu o limite de ${ROUBO_LIMIT_PER_DAY} roubos por dia!`);
  }

  await awardAchievementInCommand(client, data, "primeiro_roubo");
  await awardAchievementInCommand(client, data, "dependente");
  await awardAchievementInCommand(client, data, "ladrao_pessimo");
}