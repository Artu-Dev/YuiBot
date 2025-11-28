import { getOrCreateUser } from "../database.js";


export async function run(client, message) {
    const mentionedUser = message.mentions.users.first();

    const targetUserId = mentionedUser ? mentionedUser.id : message.author.id;
    const targetUser = getOrCreateUser(targetUserId);

    if (!mentionedUser) {
        if (targetUser) {
            return await message.reply(
                `Você tem ${targetUser.charLeft} caracteres restantes!`
            );
        } else {
            return await message.reply(
                "Ainda não te registrei mano, manda uma mensagem aí (mas sem ser comando burro)."
            );
        }
    }

    if (targetUser) {
        return await message.reply(
            `O usuário **${mentionedUser.username}** tem ${targetUser.charLeft} caracteres restantes.`
        );
    } else {
        return await message.reply(
            `O usuário **${mentionedUser.username}** ainda não está registrado.`
        );
    }
}

export const name = "chars";