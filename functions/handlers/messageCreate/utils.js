/**
 * Utilitários para extração de dados de mensagem
 */

export function extractImageUrl(message) {
  if (!message.attachments.size) return null;

  const imageAttachment = message.attachments.find((a) => {
    const isType = a.contentType?.startsWith("image/");
    const isExt = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.name ?? "");
    return isType || isExt;
  });

  return imageAttachment?.url ?? null;
}
