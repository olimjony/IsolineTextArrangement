import { Polyline, PlacedLabel } from './types';
import { FONT_SIZE, FONT_FAMILY } from './labelPlacement';

export type ColorMode = 'rainbow' | 'single';

export const SCENE_BG = '#f1f5f9';
export const GRID_COLOR = '#cbd5e1';
export const SELECT_COLOR = '#f97316';

export interface SceneOptions {
  sceneWidth: number;        // ширина сцены в координатах сцены
  sceneHeight: number;       // высота сцены в координатах сцены
  pixelRatio: number;        // во сколько раз пиксели холста больше координат сцены (для высокого DPI)
  polylines: Polyline[];
  placedLabels: PlacedLabel[];
  showGrid: boolean;
  background: string;
  selectedId?: string | null;
  /** Размер шрифта подписи (px). Если не задан, используется FONT_SIZE. */
  fontSize?: number;
  /** Принудительная толщина линий — переопределяет polyline.lineWidth. */
  lineWidthOverride?: number;
  /** Если 'single' и задан singleColor — все ломаные и подписи одного цвета. */
  colorMode?: ColorMode;
  singleColor?: string;
}

/**
 * Чистый рендер сцены: сетка → ломаные → "вырезание" под подписями → подписи.
 * Контекст должен уже быть масштабирован вызывающим (ctx.scale(pixelRatio, pixelRatio)),
 * чтобы все координаты были в координатах сцены, а пиксели холста — высокого разрешения.
 *
 * Аналогия с MFC: вызывающий «меняет графический контекст» (CDC) — экран, принтер, PDF —
 * подставляя нужный pixelRatio и размер холста; сама функция рисует сцену один раз и одинаково.
 */
export function drawScene(ctx: CanvasRenderingContext2D, opts: SceneOptions): void {
  const { sceneWidth: W, sceneHeight: H, pixelRatio } = opts;

  // ── Фон ────────────────────────────────────────────────────────────────────
  ctx.fillStyle = opts.background;
  ctx.fillRect(0, 0, W, H);

  // ── Сетка ──────────────────────────────────────────────────────────────────
  if (opts.showGrid) {
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  // ── Ломаные с "вырезом" под подписями (offscreen) ──────────────────────────
  const off = document.createElement('canvas');
  off.width = Math.ceil(W * pixelRatio);
  off.height = Math.ceil(H * pixelRatio);
  const offCtx = off.getContext('2d');
  if (!offCtx) return;
  offCtx.scale(pixelRatio, pixelRatio);

  const useSingle = opts.colorMode === 'single' && !!opts.singleColor;
  for (const pl of opts.polylines) {
    drawPolylineRaw(
      offCtx,
      pl,
      pl.id === opts.selectedId,
      opts.lineWidthOverride,
      useSingle ? opts.singleColor! : pl.color
    );
  }

  // Вырезаем прямоугольники под подписями
  offCtx.globalCompositeOperation = 'destination-out';
  for (const lbl of opts.placedLabels) {
    offCtx.save();
    offCtx.translate(lbl.center.x, lbl.center.y);
    offCtx.rotate(lbl.angle);
    offCtx.fillStyle = 'rgba(0,0,0,1)';
    offCtx.fillRect(
      -lbl.width / 2 - 2,
      -lbl.height / 2 - 1,
      lbl.width + 4,
      lbl.height + 2
    );
    offCtx.restore();
  }
  offCtx.globalCompositeOperation = 'source-over';

  // Перенос на основной контекст (drawImage в координатах сцены)
  ctx.drawImage(off, 0, 0, W, H);

  // ── Подписи поверх ─────────────────────────────────────────────────────────
  const fontSize = opts.fontSize ?? FONT_SIZE;
  ctx.font = `${fontSize}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const lbl of opts.placedLabels) {
    const pl = opts.polylines.find((p) => p.id === lbl.polylineId);
    if (!pl) continue;
    ctx.save();
    ctx.translate(lbl.center.x, lbl.center.y);
    ctx.rotate(lbl.angle);
    ctx.fillStyle = useSingle ? opts.singleColor! : pl.color;
    ctx.fillText(lbl.text, 0, 0);
    ctx.restore();
  }
}

function drawPolylineRaw(
  ctx: CanvasRenderingContext2D,
  pl: Polyline,
  selected: boolean,
  lineWidthOverride?: number,
  colorOverride?: string
): void {
  if (pl.points.length < 2) return;
  const lw = lineWidthOverride ?? pl.lineWidth;
  ctx.beginPath();
  ctx.strokeStyle = selected ? SELECT_COLOR : (colorOverride ?? pl.color);
  ctx.lineWidth = selected ? lw + 2 : lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.moveTo(pl.points[0].x, pl.points[0].y);
  for (let i = 1; i < pl.points.length; i++) {
    ctx.lineTo(pl.points[i].x, pl.points[i].y);
  }
  ctx.stroke();

  if (selected) {
    for (const p of pl.points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = SELECT_COLOR;
      ctx.fill();
    }
  }
}
