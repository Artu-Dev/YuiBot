import { log } from "../bot.js";

const name = "guildMemberRemove";

const execute = async (member, client) => {
  const { deleteUser } = await import("../database.js");
  const success = deleteUser(member.id, member.guild.id);
  if (!success) {
    log(`⚠️ Falha ao remover ${member.user.tag} (${member.id}) de ${member.guild.name} do banco de dados - usuário pode não existir`, "GuildMemberRemove", 33);
  }
};

export { name, execute };
