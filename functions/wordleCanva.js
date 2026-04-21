import { createCanvas } from "@napi-rs/canvas";

const C = {
  bg:           "#121213",
  tile_empty:   "#121213",
  tile_border:  "#3A3A3C",
  tile_filled:  "#121213",
  tile_filled_b:"#565758",
  correct:      "#538D4E",
  present:      "#DD52B3",
  absent:       "#3A3A3C",
  key_default:  "#818384",
  text:         "#FFFFFF",
  text_dark:    "#FFFFFF",
  header_line:  "#3A3A3C",
};

const TILE   = 66;
const GAP    =  8;
const PAD    = 24;
const COLS   =  5;
const ROWS   =  6;
const KEY_W  = 40;
const KEY_H  = 54;
const KEY_GAP =  6;
const HEADER_H = 52;

// ─── Helper: retângulo arredondado ────────────────────────────────────────────
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

// ─── Renderiza tabuleiro + teclado → Buffer PNG ───────────────────────────────
export function renderWordleImage(attempts, usedLetters) {
  const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

  const boardW   = COLS * TILE + (COLS - 1) * GAP;
  const boardH   = ROWS * TILE + (ROWS - 1) * GAP;
  const kbW      = 10 * (KEY_W + KEY_GAP) - KEY_GAP;
  const kbH      = KEY_ROWS.length * (KEY_H + KEY_GAP) - KEY_GAP;

  const canvasW  = Math.max(boardW, kbW) + PAD * 2;
  const canvasH  = HEADER_H + PAD + boardH + PAD + kbH + PAD;

  const canvas   = createCanvas(canvasW, canvasH);
  const ctx      = canvas.getContext("2d");

  // ── Fundo ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // ── Header ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = C.text;
  ctx.font      = "bold 26px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TERMOO", canvasW / 2, HEADER_H / 2);

  ctx.strokeStyle = C.header_line;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H);
  ctx.lineTo(canvasW, HEADER_H);
  ctx.stroke();

  // ── Tabuleiro ──────────────────────────────────────────────────────────────
  const boardX = (canvasW - boardW) / 2;
  const boardY = HEADER_H + PAD;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = boardX + col * (TILE + GAP);
      const y = boardY + row * (TILE + GAP);
      const attempt = attempts[row];

      if (attempt) {
        const { letter, status } = attempt[col];
        ctx.fillStyle = C[status];
        rr(ctx, x, y, TILE, TILE, 4);
        ctx.fill();

        ctx.fillStyle = C.text;
        ctx.font      = `bold ${Math.round(TILE * 0.48)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(letter, x + TILE / 2, y + TILE / 2 + 1);
      } else {
        // Linha atual (próxima tentativa) — borda mais clara
        const isCurrentRow = row === attempts.length;
        ctx.strokeStyle = isCurrentRow ? C.tile_filled_b : C.tile_border;
        ctx.lineWidth   = isCurrentRow ? 2 : 2;
        rr(ctx, x, y, TILE, TILE, 4);
        ctx.stroke();
      }
    }
  }

  // ── Teclado ────────────────────────────────────────────────────────────────
  const kbY = HEADER_H + PAD + boardH + PAD;

  for (let ri = 0; ri < KEY_ROWS.length; ri++) {
    const row    = KEY_ROWS[ri];
    const rowW   = row.length * (KEY_W + KEY_GAP) - KEY_GAP;
    const rowX   = (canvasW - rowW) / 2;

    for (let ki = 0; ki < row.length; ki++) {
      const letter = row[ki];
      const x      = rowX + ki * (KEY_W + KEY_GAP);
      const y      = kbY + ri * (KEY_H + KEY_GAP);
      const status = usedLetters[letter];

      ctx.fillStyle = status ? C[status] : C.key_default;
      rr(ctx, x, y, KEY_W, KEY_H, 4);
      ctx.fill();

      ctx.fillStyle    = C.text;
      ctx.font         = "bold 13px sans-serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(letter, x + KEY_W / 2, y + KEY_H / 2 + 1);
    }
  }

  return canvas.toBuffer("image/png");
}