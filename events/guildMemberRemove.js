const name = "guildMemberRemove";

const execute = async (member, client) => {
  const { deleteUser } = await import("../database.js");
  const success = deleteUser(member.id, member.guild.id);
  if (!success) {
    log(`⚠️  Falha ao remover usuário ${member.user.tag} (${member.id}) do banco de dados da guilda ${member.guild.name} (${member.guild.id}). Verifique se o usuário existia no banco.`, "GuildMemberRemove", 33);
  }
};

export { name, execute };
