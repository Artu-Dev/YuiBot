import { createCanvas, loadImage } from '@napi-rs/canvas';
import { GlobalFonts } from "@napi-rs/canvas";

GlobalFonts.registerFromPath("./fonts/Minecraftia.ttf", "Minecraftia");
GlobalFonts.registerFromPath("./fonts/twemoji.ttf", "Twemoji");

export async function gerar_conquista(usuario, achievement, size = "normal") {
    const template = await loadImage('./img/achievmentTemplate.png');
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(template, 0, 0);

    if(size === "small") {
        ctx.font = "17px Minecraftia";
        ctx.fillStyle = "#ffff00";
        ctx.fillText(`${achievement.name}`, 60, 40);

        ctx.font = "11px Minecraftia";
        ctx.fillStyle = "#fff";
        ctx.fillText(`${achievement.description}`, 60, 55);
    } else {
        ctx.font = "17px Minecraftia";
        ctx.fillStyle = "#ffff00";
        ctx.fillText(`${achievement.name}`, 65, 40);

        ctx.font = "17px Minecraftia";
        ctx.fillStyle = "#fff";
        ctx.fillText(`${achievement.description}`, 65, 60);
    }

    ctx.font = "32px Twemoji"
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(achievement.emoji, 12 + 20, 12 + 20 + 5);
    return canvas.toBuffer("image/png");
}