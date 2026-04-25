
import { SlashCommandBuilder, EmbedBuilder, ChannelFlags } from "discord.js";

export const name = "ping";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Verifica a latência do bot.");

function parseArgs(data) {
  // No args for ping
  return {};
}

export async function execute(client, data) {
  const apiLatency = Math.round(client.ws.ping);

  let sent;
  if (data.fromInteraction) {
    const replyOpts = {
      content: "Calculando ping...",
      withResponse: true,
    };
    if (data.isEphemeral) replyOpts.flags = ChannelFlags.Ephemeral;
    sent = await data.reply(replyOpts);
  } else {
    sent = await data.reply("Calculando ping...");
  }

  const messageLatency = Date.now() - sent.createdTimestamp;

  const embed = new EmbedBuilder()
    .setColor("#4ECDC4")
    .setTitle("🏓 Pong!")
    .setDescription(`Latência da API: **${apiLatency}ms**\nLatência de resposta: **${messageLatency}ms**`);

  await sent.edit({ content: null, embeds: [embed] });
}

