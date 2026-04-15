import { createCanvas, loadImage } from '@napi-rs/canvas';
import { GlobalFonts } from "@napi-rs/canvas";

GlobalFonts.registerFromPath("./fonts/Minecraftia.ttf", "Minecraftia");
GlobalFonts.registerFromPath("./fonts/twemoji.ttf", "Twemoji"); 

function extrairIdEmoji(emojiString) {
    const match = emojiString.match(/<?a?:?\w+:(\d+)>?/);
    return match ? match[1] : null;
}

export async function gerar_conquista(usuario, achievement, size = "normal") {
    const template = await loadImage('./img/achievmentTemplate.png');
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(template, 0, 0);

    if(size === "small") {
        ctx.font = "17px Minecraftia";
        ctx.fillStyle = "#ffff00";
        ctx.fillText(`${achievement.title}`, 60, 40);

        ctx.font = "11px Minecraftia";
        ctx.fillStyle = "#fff";
        ctx.fillText(`${achievement.description}`, 60, 55);
    } else {
        ctx.font = "17px Minecraftia";
        ctx.fillStyle = "#ffff00";
        ctx.fillText(`${achievement.title}`, 65, 40);

        ctx.font = "17px Minecraftia";
        ctx.fillStyle = "#fff";
        ctx.fillText(`${achievement.description}`, 65, 60);
    }
    

    const emojiId = extrairIdEmoji(achievement.icon);
    const isDiscordId = emojiId && /^\d+$/.test(emojiId);

    if (isDiscordId) {
        try {
            const isAnimated = achievement.icon.includes('<a:');
            const extension = isAnimated ? 'gif' : 'png';
            const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${extension}`;
            
            const emojiImg = await loadImage(emojiUrl);
            ctx.drawImage(emojiImg, 16, 16, 32, 32);
        } catch (error) {
            console.error('Erro ao carregar emoji do Discord:', error);
            desenharEmojiTexto(ctx, "🏆");
        }
    } else {
        desenharEmojiTexto(ctx, achievement.icon);
    }

    return canvas.toBuffer("image/png");
}

function desenharEmojiTexto(ctx, emoji) {
    ctx.font = "32px Twemoji";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, 32, 32); 
}