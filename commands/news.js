import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { generateFakeNews, generateFullArticle } from "../functions/generateNews.js";
import { parseMessage } from "../functions/utils.js";
import { createNewsImage } from "../functions/newsImage.js";

export async function run(client, message) {
  try {
    const { guildId, channelId } = parseMessage(client, message);

    const loadingMsg = await message.channel.send('📰 *Gerando notícia exclusiva...*');

    const newsHeadline = await generateFakeNews(channelId, guildId);
    const article = await generateFullArticle(newsHeadline);


    const imageBuffer = await createNewsImage(newsHeadline, article);
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'noticia.png' });

    const embed = new EmbedBuilder()
      .setTitle('📰 ÚLTIMA HORA!')
      .setDescription(`**${newsHeadline}**`)
      .setColor('#C4170C') 
      .setImage('attachment://noticia.png')
      .setTimestamp()
      .setFooter({ 
        text: '⚠️ Esta notícia é 100% REAL PORRA!!!!' 
      });

    await loadingMsg.delete();
    await message.channel.send({ embeds: [embed], files: [attachment] })

  } catch (error) {
    console.error('Erro ao gerar fake news:', error);
    await message.reply('vai da pra gerar samerda nao, deu erro aqui boy');
  }
}

export const name = "news";