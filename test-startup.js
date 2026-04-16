// Teste de startup simples
import { Client, GatewayIntentBits } from "discord.js";
console.log("✅ discord.js imported successfully");

import { readdirSync } from "fs";
console.log("✅ fs imported successfully");

import dotenv from "dotenv";
console.log("✅ dotenv imported successfully");

import path from "path";
console.log("✅ path imported successfully");

import Config from "./config.js";
console.log("✅ config imported successfully");

import { dbBot, getGuildUsers, addChars, getServerConfig, addCharsBulk, initializeDbBot } from "./database.js";
console.log("✅ database functions imported successfully");

import nodeCron from "node-cron";
console.log("✅ node-cron imported successfully");

import { cleanupLeftUsers } from "./functions/cleanUsers.js";
console.log("✅ cleanUsers imported successfully");

import { registerCommands } from "./registerCommands.js";
console.log("✅ registerCommands imported successfully");

import { runMonthlyEvent, shouldRunMonthlyEvent } from "./functions/monthlyEvent.js";
console.log("✅ monthlyEvent imported successfully");

import dayjs from "dayjs";
console.log("✅ dayjs imported successfully");

// Test key function imports from new structure
import { generateAiRes } from "./functions/ai/generateResponse.js";
console.log("✅ generateAiRes (from ai/generateResponse.js) imported successfully");

import { sayInCall } from "./functions/voice/sayInCall.js";
console.log("✅ sayInCall (from voice/sayInCall.js) imported successfully");

import { penalities } from "./functions/penalties/penalities.js";
console.log("✅ penalities (from penalties/penalities.js) imported successfully");

console.log("\n✅✅✅ ALL IMPORTS SUCCESSFUL - PHASE 1 COMPLETE ✅✅✅\n");
