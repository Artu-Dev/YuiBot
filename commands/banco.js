import { SlashCommandBuilder, EmbedBuilder, ChannelFlags } from 'discord.js';
import { getBankBalance, depositToBank, applyDailyBankInterest, withdrawFromBank } from '../database.js';
import { getOrCreateUser, setUserProperty, getServerConfig } from '../database.js';

export const name = "banco";
export const aliases = ["bank", "poupanca", "guardar"];
export const requiresCharLimit = true;

export const data = new SlashCommandBuilder()
  .setName('banco')
  .setDescription('Gerencia sua conta bancária')
  .addSubcommand(sub => 
    sub.setName('saldo')
      .setDescription('Verifica seu saldo no banco')
  )
  .addSubcommand(sub =>
    sub.setName('depositar')
      .setDescription('Deposita chars no banco')
      .addIntegerOption(opt =>
        opt.setName('quantidade')
          .setDescription('Quantidade de chars para depositar')
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand(sub =>
    sub.setName('sacar')
      .setDescription('Saca chars do banco')
      .addIntegerOption(opt =>
        opt.setName('quantidade')
          .setDescription('Quantidade de chars para sacar')
          .setRequired(true)
          .setMinValue(1)
      )
  );

function parseArgs(data) {
  if (data.fromInteraction) {
    const subcommand = data.getSubcommand();
    const quantidade = data.getInteger('quantidade');
    return { subcommand, quantidade };
  }

  const args = data.content?.split(/\s+/).slice(1) ?? [];
  return {
    subcommand: args[0]?.toLowerCase(),
    quantidade: parseInt(args[1]) || 0,
    args,
  };
}

export async function execute(client, data) {
  const userId = data.userId;
  const guildId = data.guildId;

  if (!getServerConfig(guildId, 'charLimitEnabled')) {
    return await data.reply({
      content: "❌ O sistema de caracteres está desligado neste servidor!",
      flags: ChannelFlags.Ephemeral
    });
  }

  const { ensureUserExists } = await import('../database.js');
  const user = await ensureUserExists(userId, guildId);

  if (!user) {
    return await data.reply({
      content: "❌ Usuário não encontrado no banco de dados.",
      flags: ChannelFlags.Ephemeral
    });
  }

  const { subcommand, quantidade } = parseArgs(data);
  // Se nenhum subcomando válido for informado, usa 'saldo' como padrão
  let finalSubcommand = subcommand;
  if (!finalSubcommand || !['saldo', 'depositar', 'sacar'].includes(finalSubcommand)) {
    finalSubcommand = 'saldo';
  }

  if (finalSubcommand === 'saldo') {
    const bankBalance = getBankBalance(userId, guildId);
    
    // Aplica juros diários se houver saldo
    const interest = applyDailyBankInterest(userId, guildId);
    const finalBalance = getBankBalance(userId, guildId);

    const embed = new EmbedBuilder()
      .setTitle('💳 Sua Conta Bancária')
      .setColor(0x2ecc71)
      .addFields(
        { name: 'Saldo em Banco', value: `**${finalBalance}** chars`, inline: true },
        { name: 'Chars em Mão', value: `**${user.charLeft}** chars`, inline: true },
        { name: 'Total', value: `**${finalBalance + user.charLeft}** chars`, inline: false }
      )
      .setFooter({ text: 'Seus chars no banco rendem 1% ao dia! Use /banco depositar ou /banco sacar.' });

    if (interest) {
      embed.addFields({ name: '📈 Juros de Hoje', value: `+**${interest}** chars`, inline: true });
    }

    return await data.reply({ embeds: [embed], flags: data.isEphemeral ? ChannelFlags.Ephemeral : undefined });
  }

  if (finalSubcommand === 'depositar') {
    if (!quantidade || quantidade <= 0) {
      return await data.reply({
        content: "❌ Use: `$banco depositar <quantidade>`",
        flags: ChannelFlags.Ephemeral
      });
    }

    const currentChars = user.charLeft ?? 0;

    if (quantidade > currentChars) {
      return await data.reply({
        content: `❌ Você não tem **${quantidade}** chars em mão! Você tem **${currentChars}** chars.`,
        flags: ChannelFlags.Ephemeral
      });
    }

    const success = depositToBank(userId, guildId, quantidade);
    if (!success) {
      return await data.reply({
        content: "❌ Erro ao depositar. Tente novamente!",
        flags: ChannelFlags.Ephemeral
      });
    }

    await setUserProperty('charLeft', userId, guildId, currentChars - quantidade);
    const newBalance = getBankBalance(userId, guildId);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('💰 Depósito Realizado!')
      .addFields(
        { name: 'Depositado', value: `**${quantidade}** chars`, inline: true },
        { name: 'Novo Saldo no Banco', value: `**${newBalance}** chars`, inline: true }
      );

    return await data.reply({ embeds: [embed], flags: data.isEphemeral ? ChannelFlags.Ephemeral : undefined });
  }

  if (finalSubcommand === 'sacar') {
    if (!quantidade || quantidade <= 0) {
      return await data.reply({
        content: "❌ Use: `$banco sacar <quantidade>`",
        flags: ChannelFlags.Ephemeral
      });
    }

    const bankBalance = getBankBalance(userId, guildId);

    if (quantidade > bankBalance) {
      return await data.reply({
        content: `❌ Você não tem **${quantidade}** chars no banco! Saldo: **${bankBalance}** chars.`,
        flags: ChannelFlags.Ephemeral
      });
    }

    const success = withdrawFromBank(userId, guildId, quantidade);
    if (!success) {
      return await data.reply({
        content: "❌ Erro ao sacar. Tente novamente!",
        flags: ChannelFlags.Ephemeral
      });
    }

    const currentChars = user.charLeft ?? 0;
    await setUserProperty('charLeft', userId, guildId, currentChars + quantidade);
    const newBalance = getBankBalance(userId, guildId);

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🏦 Saque Realizado!')
      .addFields(
        { name: 'Sacado', value: `**${quantidade}** chars`, inline: true },
        { name: 'Novo Saldo no Banco', value: `**${newBalance}** chars`, inline: true }
      );

    return await data.reply({ embeds: [embed], flags: data.isEphemeral ? ChannelFlags.Ephemeral : undefined });
  }
}