import { reduceChars } from "../database.js";

export const limitChar = async (message) => {
  const text = message.content;
  const userId = message.author.id;
  const guildId = message.guild.id
  
  const textSize = text.length;
  const newValue = reduceChars(userId, guildId, textSize);

  if (text.toLowerCase().includes("capeta")) {
    reduceChars(userId, guildId, 500);
    message.reply("❌Palavra proibida!!! Você perdeu 500 caracteres!!!❌");
  }

  if (newValue <= 0) {
    await message.reply(`⚠️!${message.author.displayName} Você não tem mais caracteres!⚠️`);
    await message.delete();
    return;
  }

  const ROLE_GREEN  = "1443792452506091642";
  const ROLE_YELLOW = "1443792779900751883"; 
  const ROLE_RED    = "1443792854207041546";

  const member = message.member;

  await member.roles.remove([ROLE_GREEN, ROLE_YELLOW, ROLE_RED]).catch(() => {});

  if (newValue > 1000) {
    await member.roles.add(ROLE_GREEN);
  } 
  else if (newValue > 500) {
    await member.roles.add(ROLE_YELLOW);
  } 
  else {
    await member.roles.add(ROLE_RED);
  }

  // if (newValue > 1000) message.react("🟢");
  // else if (newValue > 500) message.react("🟡");
  // else message.react("🔴");
};
