import { addChars, addUserPropertyByAmount, getOrCreateUser, getRandomUserId, reduceChars, setUserProperty } from "../database.js";
import { parseMessage } from "../functions/utils.js";

export const name = "roubar";

export async function run(client, message) {
  const { userId, guildId, displayName } = parseMessage(message, client);

  const now = new Date();
  const today = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

  const user = getOrCreateUser(userId, displayName, guildId);
  const lastRouboDate = user.lastRoubo;
  const timesRoubou = Number(user.timesRoubou) || 0;

  if (lastRouboDate != today) {
    setUserProperty("timesRoubou", userId, guildId, 1);
    setUserProperty("lastRoubo", userId, guildId, today);
  } else if (timesRoubou < 3) {
    addUserPropertyByAmount("timesRoubou", userId, guildId, 1);
  } else {
    message.reply("Tu já roubou alguém 3x nas últimas 24 horas seu maldito!");
    return;
  }

  const mentionedUser = message.mentions.users.first();
  const isTargeted = !!mentionedUser;

  let victimId, victimData;

  if (isTargeted) {
    victimId = mentionedUser.id;
    victimData = getOrCreateUser(victimId, mentionedUser.displayName || mentionedUser.username, guildId);
  } else {
    victimId = getRandomUserId(guildId, userId);
    victimData = getOrCreateUser(victimId, null, guildId);
  }

  const victimChars = victimData.charLeft;
  const victimName = victimData.display_name || mentionedUser?.username || "um usuário desconhecido";

  const successChance = isTargeted ? 0.22 : 0.38;
  const penalty = isTargeted ? 150 : 100;
  const stolenAmount = isTargeted 
  ? Math.floor(victimChars * (Math.random() * 0.20 + 0.10)) 
  : Math.floor(victimChars * (Math.random() * 0.15 + 0.05));

  const randomChance = Math.random();

  if (randomChance < successChance) {
    addChars(userId, guildId, stolenAmount);
    reduceChars(victimId, guildId, stolenAmount);

    if (isTargeted) {
      message.reply(`${displayName} foi direto atrás de ${victimName} e conseguiu roubar ${stolenAmount} caracteres... dessa vez deu certo.`);
    } else {
      message.reply(`${displayName} roubou ${stolenAmount} caracteres de ${victimName}!`);
    }
  } else {
    reduceChars(userId, guildId, penalty);
    addChars(victimId, guildId, penalty);

    if (isTargeted) {
      message.reply(`${displayName} tentou roubar ${victimName} na surdina... ${victimName} pegou com a mao na jaca. ${displayName} Perdeu ${penalty} caracteres igual um betinha.`);
    } else {
      message.reply(`${displayName} foi roubar e se fodeu, foi pego na covardia e perdeu ${penalty} caracteres para ${victimName}!`);
    }
  }
}