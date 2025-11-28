import { createCanvas, loadImage } from '@napi-rs/canvas';
import { GlobalFonts } from "@napi-rs/canvas";

GlobalFonts.registerFromPath("./fonts/Minecraftia.ttf", "Minecraftia");


export async function gerar_conquista(usuario, achievement, size = "normal") {
    const template = await loadImage('./img/achievmentTemplate.png');
    // const template = await loadImage(`https://mcgen.menzerath.eu/api/v1/achievement?background=potion&title=${encodeURI(achievement.name)}&text=${encodeURI(achievement.description)}`);

    
    
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(template, 0, 0);

    // return canvas.toBuffer("image/png");

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

    const avatarURL = usuario.displayAvatarURL({ extension: "png", size: 256 });
    const avatar = await loadImage(avatarURL);
    ctx.drawImage(avatar, 12, 12, 40, 40);

    return canvas.toBuffer("image/png");
}
