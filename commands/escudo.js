import { getOrCreateUser, reduceChars, setEscudo, getEscudoExpiry } from "../database.js";
import { parseMessage } from "../functions/utils.js";

export const name = "escudo";

const ESCUDO_COST = 300;
const ESCUDO_HOURS = 24;

export async function run(client, message) {
  const { userId, guildId, displayName } = parseMessage(message, client);
  const user = getOrCreateUser(userId, displayName, guildId);

  // Verifica se já tem escudo ativo
  const currentExpiry = getEscudoExpiry(userId, guildId);
  if (currentExpiry) {
    const horasRestantes = Math.ceil(
      (currentExpiry.getTime() - Date.now()) / (1000 * 60 * 60)
    );
    await message.reply(
      `Você já tem um escudo ativo! Expira em **${horasRestantes}h**. Para que comprar dois?`
    );
    return;
  }

  // Verifica se tem chars suficientes
  if ((user.charLeft || 0) < ESCUDO_COST) {
    await message.reply(
      `O escudo custa **${ESCUDO_COST} chars** e você só tem **${user.charLeft ?? 0}**. Junta dinheiro antes.`
    );
    return;
  }

  reduceChars(userId, guildId, ESCUDO_COST);
  setEscudo(userId, guildId, ESCUDO_HOURS);

  const activateReplies = [
    `🛡️ ${displayName} ativou um escudo por **${ESCUDO_HOURS}h** por **${ESCUDO_COST} chars**. Tenta roubar agora, playboy.`,
    `🛡️ Escudo ativado! ${displayName} pagou **${ESCUDO_COST} chars** pra ficar intocável por **${ESCUDO_HOURS}h**.`,
    `🛡️ ${displayName} comprou proteção. Custa **${ESCUDO_COST} chars**, dura **${ESCUDO_HOURS}h**. Quem tentar roubar vai se machucar.`,
  ];

  await message.reply(activateReplies[Math.floor(Math.random() * activateReplies.length)]);
}

export async function runInteraction(client, interaction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  const displayName = interaction.member?.displayName || interaction.user.username;

  const user = getOrCreateUser(userId, displayName, guildId);

  const currentExpiry = getEscudoExpiry(userId, guildId);
  if (currentExpiry) {
    const horasRestantes = Math.ceil(
      (currentExpiry.getTime() - Date.now()) / (1000 * 60 * 60)
    );
    return interaction.reply({
      content: `Você já tem um escudo ativo! Expira em **${horasRestantes}h**. Para que comprar dois?`,
      ephemeral: true,
    });
  }

  if ((user.charLeft || 0) < ESCUDO_COST) {
    return interaction.reply({
      content: `O escudo custa **${ESCUDO_COST} chars** e você só tem **${user.charLeft ?? 0}**. Junta dinheiro antes.`,
      ephemeral: true,
    });
  }

  reduceChars(userId, guildId, ESCUDO_COST);
  setEscudo(userId, guildId, ESCUDO_HOURS);

  const activateReplies = [
    `🛡️ ${displayName} ativou um escudo por **${ESCUDO_HOURS}h** por **${ESCUDO_COST} chars**. Tenta roubar agora, playboy.`,
    `🛡️ Escudo ativado! ${displayName} pagou **${ESCUDO_COST} chars** pra ficar intocável por **${ESCUDO_HOURS}h**.`,
    `🛡️ ${displayName} comprou proteção. Custa **${ESCUDO_COST} chars**, dura **${ESCUDO_HOURS}h**. Quem tentar roubar vai se machucar.`,
  ];

  return interaction.reply({
    content: activateReplies[Math.floor(Math.random() * activateReplies.length)],
    ephemeral: true,
  });
}
