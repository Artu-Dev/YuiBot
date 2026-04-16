import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getServerConfig } from "../database.js";

export const name = "help";
export const aliases = ["ajuda", "comandos"];

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Exibe ajuda sobre os comandos disponíveis.");

export async function execute(client, context) {
  const prefix = getServerConfig(context.guildId, 'prefix') || "$";
  const charLimitEnabled = getServerConfig(context.guildId, 'charLimitEnabled');

  const uniqueCommands = new Map();
  for (const [name, cmd] of client.commands) {
    if (cmd.name && !uniqueCommands.has(cmd.name)) {
      uniqueCommands.set(cmd.name, cmd);
    }
  }

  const commandsList = Array.from(uniqueCommands.values())
    .filter(cmd => {
      if (cmd.requiresCharLimit && !charLimitEnabled) {
        return false;
      }
      return true;
    })
    .map(cmd => {
      const cmdName = cmd.name;
      const description = cmd.description || cmd.data?.description || "Sem descrição";
      return `**${prefix}${cmdName}** - ${description}`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor("#4ECDC4")
    .setTitle("📖 Comandos Disponíveis")
    .setDescription(
      `Aqui estão os comandos que você pode usar:\n\n${commandsList || "Nenhum comando encontrado."}\n\n`
    )
    .setFooter({ text: `Yui Mizuno Bot - ${client.user.tag}` });

  await context.reply({ embeds: [embed] });
}