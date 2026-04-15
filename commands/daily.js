import dayjs from "dayjs";
import { addChars, getOrCreateUser, setUserProperty } from "../database.js";
import { getClassModifier } from "../functions/classes.js";
import { SlashCommandBuilder } from "discord.js";

export const name = "dia";
export const aliases = ["daily", "diario", "bonusdiario"];

export const data = new SlashCommandBuilder()
  .setName("dia")
  .setDescription("Resgata seu prêmio diário de chars.");

export async function execute(client, data) {
    const { userId, guildId, displayName } = data;

    const userData = getOrCreateUser(userId, displayName, guildId);
    const lastDaily = userData.lastDailyBonus || 0;

    const now = dayjs();

    if (now.diff(dayjs(lastDaily), 'hour') < 24) {
        const nextDaily = dayjs(lastDaily).add(24, 'hour');
        const diffMs = nextDaily.diff(now);

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

        const timeString = `${hours}h ${minutes}m ${seconds}s`;

        await data.reply({ 
            content: `Você já resgatou seu prêmio diário. Tente novamente em **${timeString}**.`, 
            ephemeral: true 
        });
        return;
    }

    const classLuckyMod = getClassModifier(userData.user_class, "lucky");
    const randomChars = Math.floor(Math.random() * 101) + 50 + Math.floor(50 * classLuckyMod);

    await addChars(userId, guildId, randomChars);
    await setUserProperty('lastDailyBonus', userId, guildId, now.toISOString());

    await data.reply({ 
        content: `Você resgatou seu prêmio diário de **${randomChars} chars**!`, 
        ephemeral: true 
    });
}