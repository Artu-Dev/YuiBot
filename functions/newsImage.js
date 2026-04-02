import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import axios from 'axios';

GlobalFonts.registerFromPath(
  './fonts/twemoji.ttf',
  'Emoji'
);

GlobalFonts.registerFromPath(
  './fonts/NoticiaText-Regular.ttf',
  'Arial'
);

async function getRandomImage() {
  const url = "https://picsum.photos/1200/400";

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    maxRedirects: 5  
  });

  const buffer = Buffer.from(response.data);

  return await loadImage(buffer);
}
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];

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
  return lines;
}

export async function createNewsImage(headline, article) {
  const width = 1200;
  const padding = 60;
  const contentWidth = width - padding * 2;

  const tempCanvas = createCanvas(width, 100);
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.font = "20px Arial";

  const articleLines = wrapText(tempCtx, article, contentWidth);
  const articleHeight = articleLines.length * 30;

  const headerHeight = 90;
  const imageHeight = 420;
  const titleSpacing = 80; 
  const footerHeight = 70;

  const totalHeight =
    headerHeight + imageHeight + titleSpacing +
    200 + articleHeight + footerHeight;

  const canvas = createCanvas(width, totalHeight);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, totalHeight);

  // ===== HEADER =====
  ctx.fillStyle = "#C4170C";
  ctx.fillRect(0, 0, width, headerHeight);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 55px Arial";
  ctx.fillText("YMN", padding, 60);

  ctx.font = "bold 18px Arial";
  ctx.fillText("Yui Mizuno News", 200, 60);

  const tagX = width - 240;
  ctx.fillStyle = "#FFD700";
  ctx.fillRect(tagX, 25, 190, 40);
  ctx.fillStyle = "#C4170C";
  ctx.font = "bold 18px Arial, Emoji";
  ctx.fillText("🔴 ÚLTIMA HORA", tagX + 12, 52);

  let y = headerHeight;

  // ===== IMAGEM =====
  try {
    const randomImg = await getRandomImage();
    ctx.drawImage(randomImg, 0, y, width, imageHeight);

    const grad = ctx.createLinearGradient(0, y + imageHeight - 120, 0, y + imageHeight);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, y + imageHeight - 120, width, 120);
  } catch {
    ctx.fillStyle = "#8B0F06";
    ctx.fillRect(0, y, width, imageHeight);
  }

  y += imageHeight + 60;

  // ===== TÍTULO =====
  ctx.fillStyle = "#1A1A1A";
  ctx.font = "bold 48px Arial, Emoji";

  const titleLines = wrapText(ctx, headline, contentWidth * 0.92); // MAIS LARGO
  const titleLH = 58;

  for (let i = 0; i < titleLines.length; i++) {
    ctx.fillText(titleLines[i], padding, y + i * titleLH);
  }

  y += titleLines.length * titleLH + 40;

  // ===== DIVISÓRIA =====
  ctx.strokeStyle = "#C4170C";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();

  y += 25;

  // ===== DATA + VERIFICADO =====
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  ctx.fillStyle = "#666";
  ctx.font = "17px Arial";
  ctx.fillText(`${dateStr} às ${timeStr}`, padding, y);

  ctx.fillStyle = "#C4170C";
  ctx.font = "bold 16px Arial, Emoji";
  ctx.fillText("✓ NOTÍCIA VERIFICADA", width - padding - 220, y);

  y += 50;

  // ===== ARTIGO =====
  ctx.fillStyle = "#333";
  ctx.font = "20px Arial, Emoji";

  const lh = 30;
  for (let i = 0; i < articleLines.length; i++) {
    ctx.fillText(articleLines[i], padding, y + i * lh);
  }

  y += articleLines.length * lh + 40;

  // ===== RODAPÉ =====
  ctx.fillStyle = "#F5F5F5";
  ctx.fillRect(0, y, width, footerHeight);

  ctx.fillStyle = "#999";
  ctx.font = "italic 15px Arial";
  ctx.fillText("© G1 - Todos os direitos reservados | Esta notícia é fictícia",
    padding,
    y + 45
  );

  return canvas.toBuffer("image/png");
}
