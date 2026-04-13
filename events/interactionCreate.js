import { log } from "../bot.js";
import { contextFromInteraction } from "../functions/utils.js";

export const name = "interactionCreate";

export const execute = async (interaction, client) => {
  if (!interaction.isChatInputCommand?.() || !interaction.guildId ) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  if (typeof command.execute !== "function") {
    log(`⚠️ Comando "${interaction.commandName}" sem função execute.`, "Comando", 31);
    return;
  }

  try {
    await command.execute(client, contextFromInteraction(interaction));
  } catch (error) {
    log(`❌ Erro ao executar comando "${interaction.commandName}": ${error.message}`, "Comando", 31);

    const isConnectTimeout =
      error?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
      error?.name === 'ConnectTimeoutError';

    if (isConnectTimeout) {
      log('⚠️ Discord API connect timeout. Verifique sua conexão de rede ou bloqueios de rede para o bot.', "Bot", 31);
    }

    const replyData = { content: "Ocorreu um erro ao processar o comando.", flags: 64 };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(replyData).catch(console.error);
    } else {
      await interaction.reply(replyData).catch(console.error);
    }
  }
};