import { addChars, addUserPropertyByAmount, getOrCreateUser, getRandomUserId, getUser, reduceChars, setUserProperty } from "../database.js";
import { parseMessage } from "../functions/utils.js";

export const name = "roubar";

export async function run(client, message) {
  const { userId, guildId, displayName } = parseMessage(message, client);

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
    await message.reply("Tu já roubou alguém 3x nas últimas 24 horas seu maldito!");
    return;
  }

  const mentionedUser = message.mentions.users.first();
  const isTargeted = !!mentionedUser;

  if (isTargeted && mentionedUser.id === userId) {
    await message.reply("Você não pode roubar a si mesmo.");
    return;
  }

  let victimId, victimData;

  if (isTargeted) {
    const existingVictim = getUser(mentionedUser.id, guildId);
    if (!existingVictim) {
      await message.reply("Esse usuário ainda não está no banco de dados. Ele precisa enviar mensagens antes de ser roubado.");
      return;
    }

    victimId = mentionedUser.id;
    victimData = existingVictim;
  } else {
    victimId = getRandomUserId(guildId, userId);
    if (!victimId) {
      await message.reply("Não há usuários disponíveis para roubar no momento.");
      return;
    }

    victimData = getUser(victimId, guildId);
    if (!victimData) {
      await message.reply("Erro interno: não foi possível encontrar a vítima.");
      return;
    }
  }

  const victimChars = Number(victimData.charLeft) || 0;
  const victimName = victimData.display_name || mentionedUser?.username || "um usuário desconhecido";

  if (victimChars <= 0) {
    await message.reply(`${displayName} tentou roubar ${victimName}, mas ele não tem caracteres para roubar.`);
    return;
  }

  const successChance = isTargeted ? 0.22 : 0.38;
  const penalty = isTargeted ? 150 : 100;
  const stolenAmount = isTargeted
    ? Math.max(1, Math.floor(victimChars * (Math.random() * 0.20 + 0.10)))
    : Math.max(1, Math.floor(victimChars * (Math.random() * 0.15 + 0.05)));

  const noCharsReplies = [
    `${displayName} tentou roubar ${victimName}, mas ele não tem caracteres suficientes e voltou de mãos vazias.`,
    `${displayName} passou reto de ${victimName}, porque lá não tinha nada para roubar.`,
    `${displayName} quase conseguiu roubar, mas ${victimName} não tinha nem onde cair morto.`
  ];

  const successTargetedReplies = [
    `${displayName} foi direto atrás de ${victimName} e conseguiu roubar ${stolenAmount} caracteres...`,
    `${displayName} foi sem dó em ${victimName} e saiu com ${stolenAmount} caracteres no cu, sem ser visto.`,
    `${displayName} sacou o brinquedo de furar moletom e pediu a ${victimName}, ${stolenAmount} caracteres, ele aceitou numa boa.`
  ];

  const successRandomReplies = [
    `${displayName} roubou ${stolenAmount} caracteres de ${victimName}!`,
    `${victimName} não viu ${displayName} chegando e acordou com ${stolenAmount} chars a menos.`,
    `${displayName} deu um migué esperto e levou ${stolenAmount} caracteres de ${victimName}.`
  ];

  const failTargetedReplies = [
    `${displayName} tentou roubar ${victimName} na surdina... ${victimName} pegou com a mao na jaca. ${displayName} perdeu ${penalty} caracteres igual um betinha.`,
    `${victimName} estava ligado e virou o jogo: ${displayName} perdeu ${penalty} caracteres no sufoco.`,
    `Plano falhou! ${displayName} foi pego ao tentar roubar ${victimName} e caiu ${penalty} chars na conta deles.`
  ];

  const failRandomReplies = [
    `${displayName} foi roubar e se fodeu, foi pego na covardia e perdeu ${penalty} caracteres para ${victimName}!`,
    `${displayName} se deu mal na ação e acabou doando ${penalty} caracteres para ${victimName}.`,
    `Tentativa falhou: ${displayName} levou ${penalty} chars na cara e ${victimName} saiu rindo.`
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
    await message.reply(getRandom(replies.noChars));
    return;
  }

  const randomChance = Math.random();

  if (randomChance < successChance) {
    addChars(userId, guildId, stolenAmount);
    reduceChars(victimId, guildId, stolenAmount);

    if (isTargeted) {
      await message.reply(getRandom(replies.successTargeted));
    } else {
      await message.reply(getRandom(replies.successRandom));
    }
  } else {
    reduceChars(userId, guildId, penalty);
    addChars(victimId, guildId, penalty);

    if (isTargeted) {
      await message.reply(getRandom(replies.failTargeted));
    } else {
      await message.reply(getRandom(replies.failRandom));
    }
  }
}