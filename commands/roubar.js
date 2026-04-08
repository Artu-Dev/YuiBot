import { SlashCommandBuilder } from "discord.js";
import { addChars, addUserPropertyByAmount, getOrCreateUser, getRandomUserId, getUser, reduceChars, setUserProperty } from "../database.js";
import { applyClassModifier, getClassModifier, ESCUDO_BLOCK_BASE } from "../functions/classes.js";
import { awardAchievementInCommand } from "../functions/achievements.js";
import { sample } from 'es-toolkit';

// ==================== CONFIG ====================
const STEAL_PERCENTAGE_MIN = 0.05;
const STEAL_PERCENTAGE_MAX = 0.30;
const SUCCESS_CHANCE_TARGETED = 0.22;
const SUCCESS_CHANCE_RANDOM = 0.38;
const PENALTY_TARGETED = 150;
const PENALTY_RANDOM = 100;
const ROUBO_LIMIT_PER_DAY = 3;

export const name = "roubar";

export const data = new SlashCommandBuilder()
  .setName("roubar")
  .setDescription("Rouba caracteres de outro usuário (ou aleatório se não especificar).")
  .addUserOption(option =>
    option.setName("usuário")
      .setDescription("O usuário para roubar (opcional, aleatório se não especificar)")
      .setRequired(false)
  );

function parseArgs(data) {
  if (data.fromInteraction) {
    return { mentionedUser: data.getUser("usuário") };
  }
  return { mentionedUser: data.mentionedUser };
}

export async function execute(client, data) {
  const { userId, guildId, displayName } = data;
  const { mentionedUser } = parseArgs(data);

  const now = new Date();
  const today = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

  const user = getOrCreateUser(userId, displayName, guildId);

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
    await data.reply(`Tu já roubou alguém ${ROUBO_LIMIT_PER_DAY}x nas últimas 24 horas seu maldito!`);
    return;
  }

  const isTargeted = !!mentionedUser;

  if (isTargeted && mentionedUser.id === userId) {
    await data.reply("Você não pode roubar a si mesmo seu esquisito");
    return;
  }

  let victimId, victimData;

  if (isTargeted) {
    victimData = getUser(mentionedUser.id, guildId);
    if (!victimData) {
      await data.reply("Esse usuário ainda não está no banco de dados. Ele precisa mandar mensagem antes.");
      return;
    }
    victimId = mentionedUser.id;
  } else {
    victimId = getRandomUserId(guildId, userId);
    if (!victimId) {
      await data.reply("Não tem ninguém pra roubar no momento.");
      return;
    }
    victimData = getUser(victimId, guildId);
    if (!victimData) {
      await data.reply("Erro interno: não foi possível encontrar a vítima.");
      return;
    }
  }

  const victimChars = Number(victimData.charLeft) || 0;
  const victimName = victimData.display_name || mentionedUser?.username || "um usuário desconhecido";

  if (victimChars <= 0) {
    await data.reply(`${displayName} tentou roubar ${victimName}, mas ele não tem caracteres para roubar.`);
    return;
  }

  const { hasEscudo } = await import("../database.js");

  const userClass = user.user_class || 'none';
  const victimClass = victimData.user_class || 'none';

  let escudoUserHint = "";
  let successChance = Math.min(1, applyClassModifier(
    isTargeted ? SUCCESS_CHANCE_TARGETED : SUCCESS_CHANCE_RANDOM,
    isTargeted ? 'singleRobSuccess' : 'robSuccess',
    userClass
  ));

  const penalty = applyClassModifier(isTargeted ? PENALTY_TARGETED : PENALTY_RANDOM, 'robCost', userClass);
  const victimDefense = getClassModifier(victimClass, 'robDefense');
  const victimHasEscudo = hasEscudo(victimId, guildId);

  if (victimHasEscudo) {
    const escudoBonus = getClassModifier(victimClass, 'escudoBonus');
    const blockChance = Math.min(1, Math.max(0, ESCUDO_BLOCK_BASE + escudoBonus));
    successChance *= (1 - blockChance);
    escudoUserHint = `\n\n_A vítima tinha **escudo** ativo — bloqueou ${Math.round(blockChance * 100)}% da sua chance._`;
    
    // const shieldStrength = Math.min(1, Math.max(0, ESCUDO_BLOCK_BASE + escudoBonus));
    // const escudoMult = ESCUDO_SUCCESS_FACTOR_MIN + (1 - shieldStrength) * ESCUDO_SUCCESS_FACTOR_SPREAD;
    // successChance *= escudoMult;
  }

  const baseStolen = Math.max(1, Math.floor(victimChars * (Math.random() * (STEAL_PERCENTAGE_MAX - STEAL_PERCENTAGE_MIN) + STEAL_PERCENTAGE_MIN)));
  const stolenAmount = Math.max(1, Math.floor(baseStolen * (1 + getClassModifier(userClass, 'robDamage') - victimDefense)));

  const successTargetedReplies = [
    `✅ ${displayName} foi direto atrás de ${victimName} e conseguiu roubar ${stolenAmount} caracteres...`,
    `✅ ${displayName} foi sem dó em ${victimName} e saiu com ${stolenAmount} caracteres no cu, sem ser visto.`,
    `✅ ${displayName} sacou o brinquedo de furar moletom e pediu a ${victimName}, ${stolenAmount} caracteres, ele aceitou numa boa.`
  ];

  const successRandomReplies = [
    `✅ ${displayName} roubou ${stolenAmount} caracteres de ${victimName} na covardia!`,
    `✅ ${victimName} moscou feiao e ${displayName} sem piedade alguma levou ${stolenAmount} chars de seu patrimonio.`,
    `✅ ${displayName} foi safado e roubou ${stolenAmount} caracteres de ${victimName}. (sem ele perceber rsrs)`
  ];

  const failTargetedReplies = [
    `❌ ${displayName} tentou roubar ${victimName} na surdina... mas ${victimName} pegou com a mao na jaca. ${displayName} perdeu pra ele ${penalty} caracteres igual um betinha.`,
    `❌ ${victimName} estava paranoico com os cara no teto, viu ${displayName} chegando, pegou a makita e passou a mao em ${penalty} caracteres.`,
    `❌ deu ruim menó! ${displayName} foi pego ao tentar roubar ${victimName} e teve que fazer um pix ${penalty} chars pra ele.`
  ];

  const failRandomReplies = [
    `❌ ${displayName} foi roubar e se fodeu, foi pego no flagra e perdeu ${penalty} caracteres para ${victimName}!`,
    `❌ ${displayName} se deu mal na ação e acabou doando contra sua vontade ${penalty} caracteres para ${victimName}.`,
    `❌ ${displayName} foi burrao e acabou doando ${penalty} chars pra ${victimName} viva a benevolencia.`
  ];

  const success = Math.random() < successChance;

  addUserPropertyByAmount("total_robberies", userId, guildId, 1);

  if (success) {
    addChars(userId, guildId, stolenAmount);
    reduceChars(victimId, guildId, stolenAmount);
    setUserProperty("consecutive_robbery_losses", userId, guildId, 0);

    const replyText = isTargeted
      ? sample(successTargetedReplies)
      : sample(successRandomReplies);

    await data.reply(replyText + escudoUserHint);

    if (isTargeted) {
      const bountyValue = Number(victimData.total_bounty_value) || 0;
      const bountyPlacer = victimData.bounty_placer;

      if (bountyValue > 0 && bountyPlacer) {
        addChars(userId, guildId, bountyValue);
        addUserPropertyByAmount("bounties_claimed", userId, guildId, 1);

        setUserProperty("bounty_placer", victimId, guildId, null);
        setUserProperty("total_bounty_value", victimId, guildId, 0);

        await data.followUp(
          `💰 **Recompensa coletada!** ${displayName} pegou os **${bountyValue} chars** que estavam na cabeça de ${victimName}!`
        );
      }
    }
  } else {
    reduceChars(userId, guildId, penalty);
    addChars(victimId, guildId, penalty);
    addUserPropertyByAmount("consecutive_robbery_losses", userId, guildId, 1);

    const replyText = isTargeted
      ? sample(failTargetedReplies)
      : sample(failRandomReplies);

    await data.reply(replyText + escudoUserHint);
  }

  if (daily_robberies >= ROUBO_LIMIT_PER_DAY) {
    await data.followUp("⚠️ Você atingiu o limite de 3 roubos por dia!");
  }

  // ── Conquistas (baseadas nos stats do schema) ────────────────────────────────
  await awardAchievementInCommand(client, data, "primeiro_roubo");
  await awardAchievementInCommand(client, data, "dependente");
  await awardAchievementInCommand(client, data, "apostador");
}