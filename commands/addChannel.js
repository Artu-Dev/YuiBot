export const name = "add-channel";

export async function run(client, message) {
  const db = client.dbBot;

  if (!db.data.channels.includes(message.channel.id)) {
    db.data.channels.push(message.channel.id);
    await db.write();
    message.reply("Canal adicionado!");
  }
}
