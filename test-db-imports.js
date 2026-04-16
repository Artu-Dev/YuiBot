import * as db from "./database.js";

console.log("✅ Database imports successful");
console.log("Exported functions:");
console.log("- Users:", typeof db.getUser, typeof db.addChars);
console.log("- Penalties:", typeof db.getUserPenality, typeof db.setUserPenality);
console.log("- Achievements:", typeof db.getAchievements, typeof db.unlockAchievement);
console.log("- Messages:", typeof db.saveMessageContext, typeof db.getRecentMessages);
console.log("- Settings:", typeof db.getServerConfig, typeof db.getChannels);
console.log("- Events:", typeof db.getDailyEventFromDB, typeof db.saveDailyEvent);
console.log("- Words:", typeof db.getProhibitedWords, typeof db.getRandomProhibitedWord);
console.log("- Core:", typeof db.db, typeof db.dbBot, typeof db.initializeDbBot);

console.log("\n✅ All imports verified!");
process.exit(0);
