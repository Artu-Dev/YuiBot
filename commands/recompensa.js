import { SlashCommandBuilder } from "discord.js";
import {
  getOrCreateUser,
  getUser,
  addChars,
  reduceChars,
  getBotPrefix,
  addUserPropertyByAmount,
  setUserProperty,
  addUserProperty,
} from "../database.js";
import { awardAchievementInCommand } from "../functions/achievements.js";
import { sample } from 'es-toolkit';
import { ALLOWED_MESSAGE_BOT_ID } from "../constants.js";

export const name = "recompensa";
export const aliases = ["bounty", "bountyhead", "recompensas"];

export const data = new SlashCommandBuilder()
  .setName("recompensa")
  .setDescription("Coloca uma recompensa na cabeça de alguem.")
  .addUserOption((option) =>
    option
      .setName("usuário")
      .setDescription("O usuário que vai virar alvo da recompensa")
      .setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("quantidade")
      .setDescription("Valor da recompensa em caracteres")
      .setRequired(true)
      .setMinValue(1),
);

function parseArgs(data) {
  if (data.fromInteraction) {
    return {
      targetUser: data.getUser("usuário"),
      amount: data.getInteger("quantidade"),
    };
  }

  const args = data.args ?? [];
  let amount = null;
  for (let i = args.length - 1; i >= 0; i--) {
    const t = String(args[i]).trim();
    if (/^\d+$/.test(t)) {
      amount = parseInt(t, 10);
      break;
    }
  }
  return {
    targetUser: data.mentionedUser,
    amount,
  };
}

export async function execute(client, data) {
  const { userId, displayName, guildId, content } = data;
  const { targetUser, amount } = parseArgs(data);

  if (!targetUser) {
    const p = getBotPrefix();
    return await data.reply(
      `Você precisa mencionar quem vai vai receber a recompensa.\n**Prefixo:** \`${p}recompensa @usuário <quantidade>\``,
    );
  }

  if (targetUser.id === userId) {
    return await data.reply("Você não pode colocar uma recompensa em si mesmo.");
  }

  if (targetUser.bot && targetUser.id !== ALLOWED_MESSAGE_BOT_ID) {
    return await data.reply("Bot não precisa de chars.");
  }

  if (!amount || amount <= 0) {
    return await data.reply(
      "Quantidade inválida. Precisa ser pelo menos 1 char.",
    );
  }

  const giver = getOrCreateUser(userId, displayName, guildId);
  if ((giver.charLeft || 0) < amount) {
    return await data.reply(
      `Você não tem ${amount} chars. Seu saldo é **${giver.charLeft ?? 0}**.`,
    );
  }

  const newGiverBalance = (giver.charLeft || 0) - amount;
  const receiverName = targetUser.displayName ?? targetUser.username;
  getOrCreateUser(targetUser.id, receiverName, guildId);
  reduceChars(userId, guildId, amount);

  if (amount < targetUser.rewardValue) {
    return await data.reply(
      `Ja tem uma recompensa na cabeça de ${receiverName} no valor de **${targetUser.rewardValue}** chars.\n
      Você precisa oferecer mais do que isso para substituir a recompensa existente.`,
    );
  } 

  setUserProperty("bounty_placer", targetUser.id, guildId, displayName);
  addUserProperty("bounties_placed", userId, guildId);
  setUserProperty("total_bounty_value", targetUser.id, guildId, amount);
  addUserProperty("times_bountied", targetUser.id, guildId);

  
  await awardAchievementInCommand(client, data, "generoso");

  const rewardReplies = [
    `${displayName} colocou uma recompensa de **${amount}** chars na cabeça de ${receiverName}. \nQuem tem culhão pra ir atrás?`,
    `ALVO MARCADO! ${displayName} colocou **${amount} chars** na cabeça de ${receiverName}. \nA caçada está aberta, corajosos.`,
    `${receiverName} agora tem um preço: **${amount} chars**. \nColocado por ${displayName}. \nQuem vai ser o maldito que vai cobrar essa recompensa?`,
    `**RECOMPENSA LANÇADA!** \n${displayName} colocou **${amount} chars** pela cabeça de ${receiverName}. \nMostrem do que são feitos, seus desgraçados!`,
    ` ${displayName} quer ver ${receiverName} sangrando... e colocou **${amount} chars** pra quem fizer o serviço. \nQuem topa?`,
  ];

  await data.reply(
    sample(rewardReplies),
  );
  return await data.followUp(`Seu saldo agora: **${newGiverBalance}** chars.`);
}

