import { SlashCommandBuilder } from "discord.js";
import { addChars, addUserPropertyByAmount, getOrCreateUser, getRandomUserId, getUser, reduceChars, setUserProperty } from "../database.js";
import { applyClassModifier, getClassModifier, ESCUDO_BLOCK_BASE } from "../functions/classes.js";

const ESCUDO_SUCCESS_FACTOR_MIN = 0.08;
const ESCUDO_SUCCESS_FACTOR_SPREAD = 0.14;
import { parseMessage } from "../functions/utils.js";

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
  let timesRoubou = Number(user.timesRoubou) || 0;

  if (lastRouboDate !== today) {
    setUserProperty("timesRoubou", userId, guildId, 1);
    setUserProperty("lastRoubo", userId, guildId, today);
    timesRoubou = 1;
  } else if (timesRoubou < 3) {
    addUserPropertyByAmount("timesRoubou", userId, guildId, 1);
    timesRoubou += 1;
  } else {
    await data.reply("Tu já roubou alguém 3x nas últimas 24 horas seu maldito!");
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

  const { hasEscudo } = await import("../database.js");

  const userClass = user.user_class || 'none';
  const victimClass = victimData.user_class || 'none';

  let successChance = applyClassModifier(isTargeted ? 0.22 : 0.38, isTargeted ? 'singleRobSuccess' : 'robSuccess', userClass);
  const penalty = applyClassModifier(isTargeted ? 150 : 100, 'robCost', userClass);
  const victimDefense = getClassModifier(victimClass, 'robDefense');

  const victimHasEscudo = hasEscudo(victimId, guildId);
  let escudoUserHint = "";
  if (victimHasEscudo) {
    const escudoBonus = getClassModifier(victimClass, 'escudoBonus');
    const shieldStrength = Math.min(1, Math.max(0, ESCUDO_BLOCK_BASE + escudoBonus));
    const escudoMult =
      ESCUDO_SUCCESS_FACTOR_MIN + (1 - shieldStrength) * ESCUDO_SUCCESS_FACTOR_SPREAD;
    successChance *= escudoMult;
    escudoUserHint =
      "\n\n_A vítima tinha **escudo** ativo — sua chance de sucesso foi bem menor._";
  }

  if (victimChars <= 0) {
    await data.reply(`${displayName} tentou roubar ${victimName}, mas ele não tem caracteres para roubar.`);
    return;
  }

  const baseStolen = isTargeted
    ? Math.max(1, Math.floor(victimChars * (Math.random() * 0.20 + 0.10)))
    : Math.max(1, Math.floor(victimChars * (Math.random() * 0.15 + 0.05)));
  const stolenAmount = Math.max(1, Math.floor(baseStolen * (1 + getClassModifier(userClass, 'robDamage') - victimDefense)));

  const noCharsReplies = [
    `${displayName} tentou roubar ${victimName}, mas ele é um pobre que nao tem um centavo furado na merda do bolso.`,
    `${displayName} nao conseguiu roubar ${victimName}, porque nem o mais passa fome tem coragem dde roubar alguem tao mizeravel.`,
    `${displayName} quase conseguiu roubar, mas ${victimName} não tinha nem onde cair morto.`
  ];

  const successTargetedReplies = [
    `${displayName} foi direto atrás de ${victimName} e conseguiu roubar ${stolenAmount} caracteres...`,
    `${displayName} foi sem dó em ${victimName} e saiu com ${stolenAmount} caracteres no cu, sem ser visto.`,
    `${displayName} sacou o brinquedo de furar moletom e pediu a ${victimName}, ${stolenAmount} caracteres, ele aceitou numa boa.`
  ];

  const successRandomReplies = [
    `${displayName} roubou ${stolenAmount} caracteres de ${victimName} na covardia!`,
    `${victimName} moscou feiao e ${displayName} sem piedade alguma levou ${stolenAmount} chars de seu patrimonio.`,
    `${displayName} foi safado e roubou ${stolenAmount} caracteres de ${victimName}. (sem ele perceber rsrs)`
  ];

  const failTargetedReplies = [
    `${displayName} tentou roubar ${victimName} na surdina... mas ${victimName} pegou com a mao na jaca. ${displayName} perdeu pra ele ${penalty} caracteres igual um betinha.`,
    `${victimName} estava paranoico com os cara no teto, viu ${displayName} pegou a makita e te levou ${penalty} caracteres.`,
    `deu ruim menó! ${displayName} foi pego ao tentar roubar ${victimName} e teve que fazer um pix ${penalty} chars pra ele.`
  ];

  const failRandomReplies = [
    `${displayName} foi roubar e se fodeu, foi pego no flagra e perdeu ${penalty} caracteres para ${victimName}!`,
    `${displayName} se deu mal na ação e acabou doando contra sua vontade ${penalty} caracteres para ${victimName}.`,
    `${displayName} foi burrao e acabou doando ${penalty} chars pra ${victimName} viva a benevolencia.`
  ];

  const replies = {
    noChars: noCharsReplies,
    successTargeted: successTargetedReplies,
    successRandom: successRandomReplies,
    failTargeted: failTargetedReplies,
    failRandom: failRandomReplies,
  };

  const getRandom = (list) => list[Math.floor(Math.random() * list.length)];

  if (victimChars <= 0) {
    await data.reply(getRandom(replies.noChars));
    return;
  }

  const randomChance = Math.random();

  if (randomChance < successChance) {
    addChars(userId, guildId, stolenAmount);
    reduceChars(victimId, guildId, stolenAmount);

    if (isTargeted) {
      await data.reply(getRandom(replies.successTargeted) + escudoUserHint);
    } else {
      await data.reply(getRandom(replies.successRandom) + escudoUserHint);
    }
  } else {
    reduceChars(userId, guildId, penalty);
    addChars(victimId, guildId, penalty);

    if (isTargeted) {
      await data.reply(getRandom(replies.failTargeted) + escudoUserHint);
    } else {
      await data.reply(getRandom(replies.failRandom) + escudoUserHint);
    }
  }
}