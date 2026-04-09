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


  if (!targetUser) {
    const p = getBotPrefix();
    return await data.reply(
      `Você precisa mencionar quem vai receber.\n**Prefixo:** \`${p}pix @usuário <quantidade>\``,
    );
  }

  if (targetUser.id === userId) {
    return await data.reply("Você não pode fazer pix pra si mesmo.");
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

  const receiverName = targetUser.displayName ?? targetUser.username;
  const newGiverBalance = (giver.charLeft || 0) - amount;
  getOrCreateUser(targetUser.id, receiverName, guildId);

  reduceChars(userId, guildId, amount);
  addChars(targetUser.id, guildId, amount);
  addUserPropertyByAmount("total_chars_donated", userId, guildId, amount);
  await awardAchievementInCommand(client, data, "generoso");

  const donateReplies = [
    `${displayName} fez um pix de **${amount}** chars para ${receiverName}. Que alma bondosa.`,
    `${receiverName} ganhou **${amount}** chars no pix de ${displayName}. Deve ter feito muita coisa boa.`,
    `${displayName} abriu o coração e tacou-lhe **${amount}** chars no pix de ${receiverName}.`,
    `Transferência concluída: **${amount}** chars de ${displayName} → ${receiverName}.`,
  ];

  await data.reply(
    sample(donateReplies),
  );
  return await data.followUp(`Seu saldo agora: **${newGiverBalance}** chars.`);
}
