import { log } from "../bot.js";

const name = "guildMemberRemove";

const execute = async (member, client) => {
  const { deleteUser, getUser } = await import("../database.js");
  const user = getUser(member.id, member.guild.id);
  if (user) {
    const success = deleteUser(member.id, member.guild.id);
    if (!success) {
      log(`⚠️ Falha ao remover ${member.user.tag} (${member.id}) de ${member.guild.name} do banco de dados`, "GuildMemberRemove", 33);
    }
  }
};

export { name, execute };
