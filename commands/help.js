
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const name = "help";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Exibe ajuda sobre os comandos disponíveis.");

export async function execute(client, data) {
    const commandsList = Array.from(client.commands.values())
        .map(cmd => `**/${cmd.data.name}** - ${cmd.data.description}`)
        .join("\n");

    const embed = new EmbedBuilder()
        .setColor("#4ECDC4")
        .setTitle("📖 Comandos Disponíveis")
        .setDescription(`Aqui estão os comandos que você pode usar:\n\n${commandsList}\n`)
        .setFooter({ text: `Yui Mizuno Bot - ${client.user.tag}` });

    await data.reply({ embeds: [embed], ephemeral: true });
}

