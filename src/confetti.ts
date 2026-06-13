type CardSuit = {
  symbol: string;
  color: string;
};

const CARD_SUITS: CardSuit[] = [
  { symbol: '♥', color: '#c81d25' },
  { symbol: '♦', color: '#c81d25' },
  { symbol: '♣', color: '#18212b' },
  { symbol: '♠', color: '#18212b' },
];

function pickCardSuit(seed: string): CardSuit {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return CARD_SUITS[hash % CARD_SUITS.length];
}

function drawSuitSymbol(ctx: CanvasRenderingContext2D, symbol: string, x: number, y: number, fontSize: number): void {
  ctx.font = `bold ${fontSize}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, x, y);
}

export function drawPlayingCardShape(this: { color: string }, ctx: CanvasRenderingContext2D): void {
  const width = 48;
  const height = 72;
  const radius = 10;
  const suit = pickCardSuit(this.color);

  ctx.beginPath();
  ctx.moveTo(-width / 2 + radius, -height / 2);
  ctx.lineTo(width / 2 - radius, -height / 2);
  ctx.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
  ctx.lineTo(width / 2, height / 2 - radius);
  ctx.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
  ctx.lineTo(-width / 2 + radius, height / 2);
  ctx.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
  ctx.lineTo(-width / 2, -height / 2 + radius);
  ctx.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);
  ctx.closePath();
  ctx.fillStyle = '#f8f3e8';
  ctx.strokeStyle = '#18212b';
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = suit.color;
  drawSuitSymbol(ctx, suit.symbol, -width / 2 + 11, -height / 2 + 12, 12);
  drawSuitSymbol(ctx, suit.symbol, width / 2 - 11, height / 2 - 12, 12);
  drawSuitSymbol(ctx, suit.symbol, 0, 0, 28);
}