export function getRandomTime(minSeconds, maxSeconds) {
    const min = minSeconds * 1000;
    const max = maxSeconds * 1000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
  

export function parseMessage(client, message) {
    return {
        guildId: message.guild?.id,
        userId: message.author.id,
        channelId: message.channel.id,
        displayName: message.member?.displayName || message.author.username,
        text: message.content,
        randomInt: Math.floor(Math.random() * 15) + 1,
        isMentioned: message.mentions.has(client.user),
    };
}

export const replaceMentions = async (message, content) => {
      if (!content) return content;

      const mentionRegex = /<@!?(\d+)>/g;
      let processedContent = content;

      const mentions = content.match(mentionRegex);
      if (mentions) {
        for (const mention of mentions) {
          const userId = mention.match(/\d+/)[0];
          try {
            const user = await message.guild.members.fetch(userId);
            const displayName = user.displayName || user.user.username;
            processedContent = processedContent.replace(
              mention,
              `@${displayName}`
            );
          } catch (error) {
            console.log(`Não foi possível buscar usuário ${userId}`);
          }
        }
      }

      return processedContent;
    };