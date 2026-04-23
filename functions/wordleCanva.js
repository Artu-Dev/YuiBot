import { createCanvas } from "@napi-rs/canvas";

const C = {
  bg:           "#121213",
  tile_empty:   "#121213",
  tile_border:  "#3A3A3C",
  tile_filled:  "#121213",
  tile_filled_b:"#565758",
  correct:      "#4EB045",
  present:      "#D345A8",
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

export function renderWordleImage(attempts, usedLetters) {
  const ROWS   = 6;
  const boardW = COLS * TILE + (COLS - 1) * GAP;
  const boardH = ROWS * TILE + (ROWS - 1) * GAP;
  const kbH    = 3 * (KEY_H + KEY_GAP) - KEY_GAP;
  const canvasW = Math.max(boardW, 10 * (KEY_W + KEY_GAP) - KEY_GAP) + PAD * 2;
  const canvasH = HEADER_H + PAD + boardH + PAD + kbH + PAD;

  const canvas = createCanvas(canvasW, canvasH);
  const ctx    = canvas.getContext("2d");

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.fillStyle    = C.text;
  ctx.font         = "bold 26px Verdana";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TERMOOO DA YUI", canvasW / 2, HEADER_H / 2);
  ctx.strokeStyle = C.header_line;
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(0, HEADER_H); ctx.lineTo(canvasW, HEADER_H); ctx.stroke();

  const boardX = (canvasW - boardW) / 2;
  _drawBoard(ctx, boardX, HEADER_H + PAD, attempts, false, ROWS);
  _drawKeyboard(ctx, canvasW, HEADER_H + PAD + boardH + PAD, usedLetters, usedLetters);

  return canvas.toBuffer("image/png");
}

function _drawBoard(ctx, boardX, boardY, boardAttempts, solved, rows = 6) {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < COLS; col++) {
      const x       = boardX + col * (TILE + GAP);
      const y       = boardY + row * (TILE + GAP);
      const attempt = boardAttempts[row];

      if (attempt) {
        const { letter, status } = attempt[col];
        ctx.fillStyle = C[status];
        rr(ctx, x, y, TILE, TILE, 4);
        ctx.fill();
        ctx.fillStyle    = C.text;
        ctx.font         = `bold ${Math.round(TILE * 0.48)}px Verdana`;
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(letter, x + TILE / 2, y + TILE / 2 + 1);
      } else {
        const isCurrentRow = row === boardAttempts.length && !solved;
        ctx.strokeStyle = isCurrentRow ? C.tile_filled_b : C.tile_border;
        ctx.lineWidth   = 2;
        rr(ctx, x, y, TILE, TILE, 4);
        ctx.stroke();
      }
    }
  }

  if (solved) {
    const bw = COLS * TILE + (COLS - 1) * GAP;
    const bh = rows * TILE + (rows - 1) * GAP;
    ctx.strokeStyle = C.correct;
    ctx.lineWidth   = 4;
    rr(ctx, boardX - 6, boardY - 6, bw + 12, bh + 12, 8);
    ctx.stroke();
  }
}

function _drawKeyboard(ctx, canvasW, kbY, usedLeft, usedRight) {
  const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

  for (let ri = 0; ri < KEY_ROWS.length; ri++) {
    const row  = KEY_ROWS[ri];
    const rowW = row.length * (KEY_W + KEY_GAP) - KEY_GAP;
    const rowX = (canvasW - rowW) / 2;

    for (let ki = 0; ki < row.length; ki++) {
      const letter  = row[ki];
      const x       = rowX + ki * (KEY_W + KEY_GAP);
      const y       = kbY  + ri * (KEY_H + KEY_GAP);
      const statusL = usedLeft[letter];
      const statusR = usedRight[letter];

      if (statusL || statusR) {
        // Metade esquerda
        ctx.fillStyle = statusL ? C[statusL] : C.key_default;
        ctx.beginPath();
        ctx.moveTo(x + 4, y);
        ctx.lineTo(x + KEY_W / 2, y);
        ctx.lineTo(x + KEY_W / 2, y + KEY_H);
        ctx.lineTo(x + 4, y + KEY_H);
        ctx.arcTo(x, y + KEY_H, x, y + KEY_H - 4, 4);
        ctx.lineTo(x, y + 4);
        ctx.arcTo(x, y, x + 4, y, 4);
        ctx.closePath();
        ctx.fill();

        // Metade direita
        ctx.fillStyle = statusR ? C[statusR] : C.key_default;
        ctx.beginPath();
        ctx.moveTo(x + KEY_W / 2, y);
        ctx.lineTo(x + KEY_W - 4, y);
        ctx.arcTo(x + KEY_W, y, x + KEY_W, y + 4, 4);
        ctx.lineTo(x + KEY_W, y + KEY_H - 4);
        ctx.arcTo(x + KEY_W, y + KEY_H, x + KEY_W - 4, y + KEY_H, 4);
        ctx.lineTo(x + KEY_W / 2, y + KEY_H);
        ctx.closePath();
        ctx.fill();
      } else {
        // Tecla sem status — desenha normal
        ctx.fillStyle = C.key_default;
        rr(ctx, x, y, KEY_W, KEY_H, 4);
        ctx.fill();
      }

      // Letra por cima
      ctx.fillStyle    = C.text;
      ctx.font         = "bold 13px Verdana";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(letter, x + KEY_W / 2, y + KEY_H / 2 + 1);
    }
  }
}

export function renderDuetoImage(attemptsLeft, attemptsRight, usedLeft, usedRight, solvedLeft, solvedRight) {
  const ROWS    = 7;
  const DUO_GAP = 20;
  const boardW  = COLS * TILE + (COLS - 1) * GAP;
  const boardH  = ROWS * TILE + (ROWS - 1) * GAP;
  const kbH     = 3 * (KEY_H + KEY_GAP) - KEY_GAP;
  const canvasW = boardW * 2 + DUO_GAP + PAD * 2;
  const canvasH = HEADER_H + PAD + boardH + PAD + kbH + PAD;

  const canvas = createCanvas(canvasW, canvasH);
  const ctx    = canvas.getContext("2d");

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.fillStyle    = C.text;
  ctx.font         = "bold 26px Verdana";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TERMOOO DUETO", canvasW / 2, HEADER_H / 2);
  ctx.strokeStyle = C.header_line;
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(0, HEADER_H); ctx.lineTo(canvasW, HEADER_H); ctx.stroke();

  const boardY = HEADER_H + PAD;
  _drawBoard(ctx, PAD,                    boardY, attemptsLeft,  solvedLeft,  ROWS);
  _drawBoard(ctx, PAD + boardW + DUO_GAP, boardY, attemptsRight, solvedRight, ROWS);
  _drawKeyboard(ctx, canvasW, HEADER_H + PAD + boardH + PAD, usedLeft, usedRight);

  return canvas.toBuffer("image/png");
}