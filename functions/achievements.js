import { AttachmentBuilder } from "discord.js";
import { 
    dbBot, 
    getOrCreateUser, 
    addUserProperty, 
    unlockAchievement, 
    resetTalkingToSelf
} from "../database.js";

import { gerar_conquista } from "./image.js";


export const handleAchievements = async (message) => {
    const userId = message.author.id;
    const content = message.content?.trim() ?? "";
    const now = Date.now();
    let stats = getOrCreateUser(userId);

    const hour = new Date().getHours();
    if (hour >= 2 && hour < 6) {
        addUserProperty("night_owl_messages", userId);
    }

    if (message.channel.lastAuthorId === userId) {
        addUserProperty("talking_to_self", userId);
    } else {
        resetTalkingToSelf("talking_to_self", userId);
    }

    message.channel.lastAuthorId = userId;
    stats.last_message_time = now;
    stats = getOrCreateUser(userId);

    addUserProperty("messages_sent", userId);

    const giveAchievement = async (userId, achievement, authorUserObj, size = "normal") => {

        const isNew = unlockAchievement(userId, achievement.id);
        if (!isNew) return;

        const buffer = await gerar_conquista(authorUserObj, achievement, size);
        
        await message.channel.send({
            files: [{ attachment: buffer, name: "achievement.png" }],
        });
        await message.channel.send(`**${authorUserObj.username}** ganhou **${achievement.charPoints}** caracteres como recopensa`)
    };


    if (message.mentions.users.size > 0) {
        for (const [mentionedId, mentionedUser] of message.mentions.users) {

            if (!mentionedUser.bot) {
                addUserProperty("mentions_sent", userId);
                const updated = getOrCreateUser(userId);

                if (achievements.stalker.check(updated)) {
                    await giveAchievement(userId, achievements.stalker, message.author, "small");
                }
            }

            if(mentionedId !== userId) {
                addUserProperty("mentions_received", mentionedId);
                const mentionedStats = getOrCreateUser(mentionedId);
    
                if (achievements.popular.check(mentionedStats)) {
                    await giveAchievement(
                        mentionedId,
                        achievements.popular,
                        mentionedUser
                    );
                }
            }
        }
    }


    const ONLY_CAPS = /^[A-Z\s]+$/.test(content);
    if (ONLY_CAPS) {
        addUserProperty("caps_lock_messages", userId);

        const updated = getOrCreateUser(userId);
        if (achievements.caps_addict.check(updated)) {
            await giveAchievement(userId, achievements.caps_addict, message.author, "small");
        }
    }


    const isQuestion = content.endsWith("?");
    if (isQuestion) {
        addUserProperty("question_marks", userId);
        const updated = getOrCreateUser(userId);

        if (achievements.question_everything.check(updated)) {
            await giveAchievement(
                userId,
                achievements.question_everything,
                message.author
            );
        }
    }

    if (achievements.monologue.check(stats)) {
        await giveAchievement(userId, achievements.monologue, message.author, "small");
    }

    if (achievements.chatterbox.check(stats)) {
        await giveAchievement(userId, achievements.chatterbox, message.author);
    }

    if (achievements.night_owl.check(stats)) {
        await giveAchievement(userId, achievements.night_owl, message.author, "small");
    }

    if (achievements.loved.check(stats)) {
        await giveAchievement(userId, achievements.loved, message.author);
    }

    const diffDays =
        (now - (stats.last_message_time ?? now)) / (1000 * 60 * 60 * 24);

    if (diffDays >= 30) {
        await giveAchievement(userId, achievements.ghost, message.author);
    }

};

export const achievements = {
    ghost: {
        id: 1,
        name: "Fantasma",
        emoji: "👻",
        description: "Ficou 30 dias sem mandar mensagem",
        check: () => false, // implementar depois
    },

    monologue: {
        id: 2,
        charPoints: 200,
        name: "Monólogo",
        emoji: "🎭",
        description: "Mandou 10 mensagens seguidas sem resposta",
        check: (stats) => stats.talking_to_self >= 10,
    },

    caps_addict: {
        id: 3,
        charPoints: 600,
        name: "VICIADO EM CAPS LOCK",
        emoji: "📢",
        description: "Mandou 50 mensagens em CAPS LOCK",
        check: (stats) => stats.caps_lock_messages >= 50,
    },

    night_owl: {
        id: 5,
        charPoints: 1500,
        name: "Coruja Noturna",
        emoji: "🦉",
        description: "Mandou 100 mensagens entre 2h e 6h da manhã",
        check: (stats) => stats.night_owl_messages >= 100,
    },

    popular: {
        id: 6,
        charPoints: 2000,
        name: "Popular",
        emoji: "⭐",
        description: "Recebeu 200 menções",
        check: (stats) => stats.mentions_received >= 200,
    },

    stalker: {
        id: 7,
        charPoints: 1500,
        name: "Stalker",
        emoji: "👀",
        description: "Mencionou outras pessoas 300 vezes",
        check: (stats) => stats.mentions_sent >= 300,
    },

    question_everything: {
        id: 8,
        charPoints: 1500,
        name: "Questiona Tudo",
        emoji: "❓",
        description: "Fez 150 perguntas",
        check: (stats) => stats.question_marks >= 200,
    },

    loved: {
        id: 10,
        charPoints: 2000,
        name: "Amado",
        emoji: "❤️",
        description: "Recebeu 500 reações",
        check: (stats) => stats.reactions_received >= 500,
    },

    chatterbox: {
        id: 11,
        charPoints: 2000,
        name: "Tagarela",
        emoji: "💬",
        description: "Enviou 1000 mensagens",
        check: (stats) => stats.messages_sent >= 1000,
    },
};