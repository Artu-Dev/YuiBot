import { contextFromInteraction } from "../functions/utils.js";

export const name = "interactionCreate";

export const execute = async (interaction, client) => {
  if (!interaction.isChatInputCommand?.()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  if (typeof command.execute !== "function") {
    console.warn(`⚠️ Comando "${interaction.commandName}" não tem função execute definida.`);
    return;
  }

  try {
    await command.execute(client, contextFromInteraction(interaction));
  } catch (error) {
    console.error(`❌ Erro ao executar comando "${interaction.commandName}":`, error);

    const replyData = { content: "Ocorreu um erro ao processar o comando.", flags: 64 };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(replyData).catch(console.error);
    } else {
      await interaction.reply(replyData).catch(console.error);
    }
  }
};