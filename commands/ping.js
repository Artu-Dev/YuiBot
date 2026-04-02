
export const name = "ping";

export async function run(client, message) {
  const apiLatency = Math.round(client.ws.ping);
  
  const sent = await message.reply("Calculando ping...");
  
  const messageLatency = sent.createdTimestamp - message.createdTimestamp;
  
  await sent.edit(
    `Latência da API: **${apiLatency}ms**\n` +
    `Latência de resposta: **${messageLatency}ms**`
  );
}

export async function runInteraction(client, interaction) {
  const apiLatency = Math.round(client.ws.ping);
  
  await interaction.reply("Calculando ping...");
  
  const fetchedMessage = await interaction.fetchReply();
  const messageLatency = fetchedMessage.createdTimestamp - interaction.createdTimestamp;
  
  await interaction.editReply(
    `Latência da API: **${apiLatency}ms**\n` +
    `Latência de resposta: **${messageLatency}ms**`
  );
}
