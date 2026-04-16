import { createCanvas, loadImage } from '@napi-rs/canvas';
import { GlobalFonts } from "@napi-rs/canvas";

GlobalFonts.registerFromPath("./fonts/Minecraftia.ttf", "Minecraftia");
GlobalFonts.registerFromPath("./fonts/twemoji.ttf", "Twemoji"); 

function extrairIdEmoji(emojiString) {
    const match = emojiString.match(/<?a?:?\w+:(\d+)>?/);
    return match ? match[1] : null;
}

function desenharTextoAjustavel(ctx, text, x, y, maxWidth, maxHeight, fontFamily, startFontSize, minFontSize) {
    let fontSize = startFontSize;
    let lines = [];
    let lineHeight = 0;

    while (fontSize >= minFontSize) {
        ctx.font = `${fontSize}px ${fontFamily}`;
        lineHeight = fontSize * 1.3;
        
        const words = text.split(' ');
        let currentLine = words[0];
        lines = [];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + ' ' + word).width;
            
            if (width < maxWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);

        const totalHeight = lines.length * lineHeight;
        if (totalHeight <= maxHeight) {
            break;
        }
        
        fontSize--;
    }

    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x, y + (i * lineHeight));
    }
}

export async function gerar_conquista(usuario, achievement, size = "normal") {
    const template = await loadImage('./img/achievmentTemplate.png');
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(template, 0, 0);

    // Defina os limites da "caixa" onde o texto pode ficar
    const maxWidth = template.width - 80;  // Margem direita
    const maxHeight = template.height - 50; // Margem inferior (ajuste conforme seu template)

    if(size === "small") {
        ctx.font = "17px Minecraftia";
        ctx.fillStyle = "#ffff00";
        ctx.fillText(`${achievement.title}`, 60, 40);

        ctx.fillStyle = "#fff";
        desenharTextoAjustavel(ctx, `${achievement.description}`, 60, 55, maxWidth, maxHeight, "Minecraftia", 11, 6);
    } else {
        ctx.font = "17px Minecraftia";
        ctx.fillStyle = "#ffff00";
        ctx.fillText(`${achievement.title}`, 65, 40);

        ctx.fillStyle = "#fff";
        desenharTextoAjustavel(ctx, `${achievement.description}`, 65, 60, maxWidth, maxHeight, "Minecraftia", 17, 8);
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