import { handleAchievements } from "../../achievements.js";

/**
 * Handler para sistema de conquistas
 * Responsabilidades:
 * - Verificar conquistas após cada mensagem válida
 * - Atualizar progresso do usuário
 */

export async function handleAchievementsCheck(message) {
  try {
    handleAchievements(message);
  } catch (error) {
    console.error('[handleAchievements] Erro:', error);
  }
}
