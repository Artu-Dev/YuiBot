import { SlashCommandBuilder } from "discord.js";
import {
  getOrCreateUser,
  getUser,
  addChars,
  reduceChars,
  getBotPrefix,
  addUserPropertyByAmount,
} from "../database.js";
import { awardAchievementInCommand } from "../functions/achievements.js";
import { sample } from 'es-toolkit';
import { ALLOWED_MESSAGE_BOT_ID } from "../constants.js";

export const name = "pix";

export const data = new SlashCommandBuilder()
  .setName("pix")
  .setDescription("Faz um pix de caracteres para outro usuário.")
  .addUserOption((option) =>
    option
      .setName("usuário")
      .setDescription("O usuário que vai receber os caracteres")
      .setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("quantidade")
      .setDescription("A quantidade de caracteres a doar")
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

  let finalAmount = amount;

  if (finalAmount == null && content) {
    const nums = content.match(/\d+/g);
    if (nums?.length) finalAmount = parseInt(nums[nums.length - 1], 10);
  }

  if (!targetUser) {
    const p = getBotPrefix();
    return await data.reply(
      `Você precisa mencionar quem vai receber.\n**Slash:** \`/pix\` (usuário + quantidade)\n**Prefixo:** \`${p}pix @usuário <quantidade>\``,
    );
  }

  if (targetUser.id === userId) {
    return await data.reply("Você não pode fazer pix pra si mesmo.");
  }

  if (targetUser.bot && targetUser.id !== ALLOWED_MESSAGE_BOT_ID) {
    return await data.reply("Bot não precisa de chars.");
  }

  if (!finalAmount || finalAmount <= 0) {
    return await data.reply(
      "Quantidade inválida. Precisa ser pelo menos 1 char.",
    );
  }

  const giver = getOrCreateUser(userId, displayName, guildId);
  if ((giver.charLeft || 0) < finalAmount) {
    return await data.reply(
      `Você não tem ${finalAmount} chars. Seu saldo é **${giver.charLeft ?? 0}**.`,
    );
  }

  const receiverName = targetUser.username;
  getOrCreateUser(targetUser.id, receiverName, guildId);

  reduceChars(userId, guildId, finalAmount);
  addChars(targetUser.id, guildId, finalAmount);
  addUserPropertyByAmount("total_chars_donated", userId, guildId, finalAmount);
  await awardAchievementInCommand(client, data, "generoso");

  const donateReplies = [
    `${displayName} fez um pix de **${finalAmount}** chars para ${receiverName}. Que alma bondosa.`,
    `${receiverName} ganhou **${finalAmount}** chars no pix de ${displayName}. Deve ter feito muita coisa boa.`,
    `${displayName} abriu o coração e tacou-lhe **${finalAmount}** chars no pix de ${receiverName}.`,
    `Transferência concluída: **${finalAmount}** chars de ${displayName} → ${receiverName}.`,
  ];

  return await data.reply(
    sample(donateReplies),
  );
}
