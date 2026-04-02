import { getOrCreateUser, getUser, addChars, reduceChars } from "../database.js";
import { parseMessage } from "../functions/utils.js";

export const name = "doar";

export async function runInteraction(client, interaction) {
  const targetUser = interaction.options.getUser("usuário");
  const amount = interaction.options.getInteger("quantidade");
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const displayName =
    interaction.member?.displayName || interaction.user.username;

  if (targetUser.id === userId) {
    return interaction.reply({ content: "Você não pode se doar chars.", ephemeral: true });
  }
  if (targetUser.bot) {
    return interaction.reply({ content: "Bot não precisa de chars.", ephemeral: true });
  }
  if (amount <= 0) {
    return interaction.reply({ content: "Precisa ser pelo menos 1 char.", ephemeral: true });
  }

  const { getOrCreateUser, reduceChars, addChars } = await import("../database.js");
  const giver = getOrCreateUser(userId, displayName, guildId);
  if ((giver.charLeft || 0) < amount) {
    return interaction.reply({
      content: `Você não tem ${amount} chars. Seu saldo é **${giver.charLeft ?? 0}**.`,
      ephemeral: true,
    });
  }

  const receiverName =
    interaction.guild.members.cache.get(targetUser.id)?.displayName ||
    targetUser.username;
  getOrCreateUser(targetUser.id, receiverName, guildId);
  reduceChars(userId, guildId, amount);
  addChars(targetUser.id, guildId, amount);

  const donateReplies = [
    `${displayName} doou **${amount}** chars para ${receiverName}. Que alma bondosa.`,
    `${receiverName} ganhou **${amount}** chars de ${displayName}. Deve ter feito muita coisa boa.`,
    `${displayName} abriu o coração e jogou **${amount}** chars no colo de ${receiverName}.`,
  ];
  return interaction.reply(donateReplies[Math.floor(Math.random() * donateReplies.length)]);
}

export async function run(client, message) {
  const { userId, guildId, displayName, text } = parseMessage(message, client);

  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    await message.reply("Você precisa mencionar quem vai receber. Uso: `$doar @usuário <quantidade>`");
    return;
  }

  if (targetUser.id === userId) {
    await message.reply("Você não pode se doar chars. Isso não faz sentido.");
    return;
  }

  if (targetUser.bot) {
    await message.reply("Bot não precisa de chars pra nada, para.");
    return;
  }

  // Extrai a quantidade do texto — pega o primeiro número após a menção
  const amountMatch = text.replace(/<@!?\d+>/g, "").trim().match(/^\d+/);
  if (!amountMatch) {
    await message.reply("Quantidade inválida. Uso: `$doar @usuário <quantidade>`");
    return;
  }

  const amount = parseInt(amountMatch[0], 10);
  if (amount <= 0) {
    await message.reply("Precisa ser pelo menos 1 char.");
    return;
  }

  const giver = getOrCreateUser(userId, displayName, guildId);
  if ((giver.charLeft || 0) < amount) {
    await message.reply(
      `Você não tem ${amount} chars. Seu saldo é **${giver.charLeft ?? 0}**.`
    );
    return;
  }

  // Garante que o receptor existe no banco
  const receiverName =
    message.guild.members.cache.get(targetUser.id)?.displayName ||
    targetUser.username;
  getOrCreateUser(targetUser.id, receiverName, guildId);

  reduceChars(userId, guildId, amount);
  addChars(targetUser.id, guildId, amount);

  const donateReplies = [
    `${displayName} doou **${amount}** chars para ${receiverName}. Que alma bondosa.`,
    `${receiverName} ganhou **${amount}** chars de ${displayName}. Deve ter feito muita coisa boa.`,
    `${displayName} abriu o coração e jogou **${amount}** chars no colo de ${receiverName}.`,
    `Transferência concluída: **${amount}** chars de ${displayName} → ${receiverName}.`,
  ];

  await message.reply(
    donateReplies[Math.floor(Math.random() * donateReplies.length)]
  );
}
