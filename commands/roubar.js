import { SlashCommandBuilder } from "discord.js";
import { addChars, addUserPropertyByAmount, getOrCreateUser, getRandomUserId, getUser, reduceChars, setUserProperty } from "../database.js";
import { applyClassModifier, getClassModifier, ESCUDO_BLOCK_BASE } from "../functions/classes.js";

// ==================== CONFIG ====================
const STEAL_PERCENTAGE_MIN = 0.05;
const STEAL_PERCENTAGE_MAX = 0.30;
const SUCCESS_CHANCE_TARGETED = 0.22;
const SUCCESS_CHANCE_RANDOM = 0.38;
const PENALTY_TARGETED = 150;
const PENALTY_RANDOM = 100;
const ESCUDO_SUCCESS_FACTOR_MIN = 0.08;
const ESCUDO_SUCCESS_FACTOR_SPREAD = 0.14;
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
    return {
      mentionedUser: data.getUser("usuário"),
    };
  }

  return {
    mentionedUser: data.mentionedUser,
  };
}

export async function execute(client, data) {
  const { userId, guildId, displayName } = data;
  const { mentionedUser } = parseArgs(data);

  const now = new Date();
  const today = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

  const user = getOrCreateUser(userId, displayName, guildId);
  const lastRouboDate = user.lastRoubo;
  let total_robberies = Number(user.total_robberies) || 0;

  if (lastRouboDate !== today) {
    setUserProperty("total_robberies", userId, guildId, 1);
    setUserProperty("lastRoubo", userId, guildId, today);
    total_robberies = 1;
  } else if (total_robberies < ROUBO_LIMIT_PER_DAY) {
    addUserPropertyByAmount("total_robberies", userId, guildId, 1);
    total_robberies += 1;
  } else {
    await data.reply(`Tu já roubou alguém ${ROUBO_LIMIT_PER_DAY}x nas últimas 24 horas seu maldito!`);
    return;
  }

  const isTargeted = !!mentionedUser;

  if (isTargeted && mentionedUser.id === userId) {
    await data.reply("Você não pode roubar a si mesmo.");
    return;
  }

  let victimId, victimData;

  if (isTargeted) {
    const existingVictim = getUser(mentionedUser.id, guildId);
    if (!existingVictim) {
      await data.reply("Esse usuário ainda não está no banco de dados. Ele precisa enviar mensagens antes de ser roubado.");
      return;
    }
    victimId = mentionedUser.id;
    victimData = existingVictim;
  } else {
    victimId = getRandomUserId(guildId, userId);
    if (!victimId) {
      await data.reply("Não há usuários disponíveis para roubar no momento.");
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

  let successChance = applyClassModifier(isTargeted ? SUCCESS_CHANCE_TARGETED : SUCCESS_CHANCE_RANDOM, isTargeted ? 'singleRobSuccess' : 'robSuccess', userClass);
  const penalty = applyClassModifier(isTargeted ? PENALTY_TARGETED : PENALTY_RANDOM, 'robCost', userClass);
  const victimDefense = getClassModifier(victimClass, 'robDefense');

  const victimHasEscudo = hasEscudo(victimId, guildId);
  let escudoUserHint = "";
  if (victimHasEscudo) {
    const escudoBonus = getClassModifier(victimClass, 'escudoBonus');
    const shieldStrength = Math.min(1, Math.max(0, ESCUDO_BLOCK_BASE + escudoBonus));
    const escudoMult = ESCUDO_SUCCESS_FACTOR_MIN + (1 - shieldStrength) * ESCUDO_SUCCESS_FACTOR_SPREAD;
    successChance *= escudoMult;
    escudoUserHint = "\n\n_A vítima tinha **escudo** ativo — sua chance de sucesso foi bem menor._";
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

  const getRandom = (list) => list[Math.floor(Math.random() * list.length)];
  const randomChance = Math.random();

  if (randomChance < successChance) {
    addChars(userId, guildId, stolenAmount);
    reduceChars(victimId, guildId, stolenAmount);

    if (isTargeted) {
      await data.reply(getRandom(successTargetedReplies) + escudoUserHint);
    } else {
      await data.reply(getRandom(successRandomReplies) + escudoUserHint);
    }
  } else {
    reduceChars(userId, guildId, penalty);
    addChars(victimId, guildId, penalty);

    if (isTargeted) {
      await data.reply(getRandom(failTargetedReplies) + escudoUserHint);
    } else {
      await data.reply(getRandom(failRandomReplies) + escudoUserHint);
    }

    if (total_robberies >= ROUBO_LIMIT_PER_DAY) {
      await data.followUp("⚠️ Você atingiu o limite de 3 roubos por dia!");
    }
  }
}