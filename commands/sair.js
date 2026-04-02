import { getVoiceConnection } from "@discordjs/voice";

export const name = "sair";

export async function run(client, message) {
  const connection = getVoiceConnection(message.guild.id);

  if (!connection) {
    return message.reply("Não estou em nenhum canal de voz.");
  }

  connection.destroy();
  return message.reply("Saí da call! Tchau! 👋");
}

export async function runInteraction(client, interaction) {
  const connection = getVoiceConnection(interaction.guildId);

  if (!connection) {
    return interaction.reply({ content: "Não estou em nenhum canal de voz.", ephemeral: true });
  }

  connection.destroy();
  return interaction.reply({ content: "Saí da call! Tchau! 👋", ephemeral: true });
}
