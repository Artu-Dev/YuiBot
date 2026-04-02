import { getMessageFromInteraction } from "../functions/utils.js";

const name = "interactionCreate";

const execute = async (interaction, client) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    if (typeof command.runInteraction === "function") {
      await command.runInteraction(client, interaction);
      return;
    }

    const fakeMessage = getMessageFromInteraction(interaction);
    await command.run(client, fakeMessage);
  } catch (error) {
    console.error(`Erro ao executar comando ${interaction.commandName}:`, error);

    const replyData = {
      content: "Ocorreu um erro ao processar o comando.",
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(replyData).catch(console.error);
    } else {
      await interaction.reply(replyData).catch(console.error);
    }
  }
};

export { name, execute };