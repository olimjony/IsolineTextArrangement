import { PlacedLabel, Polyline, Point } from './types';
import {
  getPolylineLength,
  getPointAtDistance,
  getRotatedCorners,
  checkRectanglesIntersect,
  segmentIntersectsOBB,
} from './geometry';
import { SegmentGrid } from './spatialIndex';
import { CollisionMask } from './collisionMask';

export const FONT_SIZE = 14;
export const FONT_FAMILY = 'Arial, sans-serif';

export function estimateTextWidth(text: string, fontSize: number = FONT_SIZE): number {
  return text.length * 8.2 * (fontSize / FONT_SIZE);
}

export const LABEL_PADDING_X = 4;
export const LABEL_MARGIN = 3;

export function labelHeightFor(fontSize: number): number {
  return fontSize + 6;
}

export const LABEL_HEIGHT = labelHeightFor(FONT_SIZE);

const SHIFT_ATTEMPTS = [0, -0.25, 0.25, -0.5, 0.5, -0.75, 0.75];

export type PlacementAlgorithm = 'sat' | 'bitmap';

export interface PlacementStats {
  attempted: number;
  placed: number;
  rejectedByLabel: number;
  rejectedByPolyline: number;
  durationMs: number;
  algorithm: PlacementAlgorithm;
  /** Память маски для bitmap-алгоритма, в КБ. */
  memoryKb?: number;
}

export interface PlacementResult {
  labels: PlacedLabel[];
  stats: PlacementStats;
}

export interface PlacementOptions {
  /** Период повторения подписи в долях её длины. */
  globalStep?: number;
  /** Размер шрифта подписи в пикселях. */
  fontSize?: number;
  /** Какой алгоритм использовать. По умолчанию 'bitmap' (быстрый). */
  algorithm?: PlacementAlgorithm;
  /** Размеры холста — нужны для bitmap-алгоритма. Если не указаны, считаются из bbox ломаных. */
  canvasWidth?: number;
  canvasHeight?: number;
}

/**
 * Точка входа: диспатчер на нужный алгоритм.
 */
export function placeLabels(
  polylines: Polyline[],
  opts: PlacementOptions = {}
): PlacementResult {
  const algorithm = opts.algorithm ?? 'bitmap';
  return algorithm === 'bitmap'
    ? placeLabelsBitmap(polylines, opts)
    : placeLabelsSAT(polylines, opts);
}

// ─────────────────────────────────────────────────────────────────────────────
// АЛГОРИТМ 1: точный — SAT/OBB + Liang-Barsky + равномерная сетка отрезков.
//
// Сложность:
//   - Сборка сетки: O(M_отрезков)
//   - Размещение: для каждой подписи проверяются все отрезки в перекрытых ячейках
//     сетки + все уже размещённые подписи (SAT с поворотом координат).
//   - В худшем случае O(N · (M / G + N)), где G — кол-во ячеек.
//
// Точная геометрия (без растеризации), но каждая проверка тяжёлая (преобразование координат).
// ─────────────────────────────────────────────────────────────────────────────
export function placeLabelsSAT(
  polylines: Polyline[],
  opts: PlacementOptions = {}
): PlacementResult {
  const t0 = performance.now();
  const placed: PlacedLabel[] = [];
  const stats: PlacementStats = {
    attempted: 0, placed: 0, rejectedByLabel: 0, rejectedByPolyline: 0,
    durationMs: 0, algorithm: 'sat',
  };

  const fontSize = opts.fontSize ?? FONT_SIZE;
  const grid = new SegmentGrid(Math.max(40, fontSize * 4));
  grid.build(polylines);

  for (const polyline of polylines) {
    if (!polyline.label.trim() || polyline.points.length < 2) continue;

    const points: Point[] =
      polyline.direction === 'reverse'
        ? [...polyline.points].reverse()
        : polyline.points;

    const totalLength = getPolylineLength(points);
    const labelWidth = estimateTextWidth(polyline.label, fontSize) + LABEL_PADDING_X * 2;
    const labelHeight = labelHeightFor(fontSize);
    const obbW = labelWidth + LABEL_MARGIN * 2;
    const obbH = labelHeight + LABEL_MARGIN * 2;

    const periodMultiplier = opts.globalStep ?? (polyline.step + 1);
    const stepDistance = periodMultiplier * labelWidth;
    if (stepDistance < 1) continue;

    let pos = labelWidth / 2;

    while (pos + labelWidth / 2 <= totalLength) {
      stats.attempted++;

      for (const shiftFrac of SHIFT_ATTEMPTS) {
        const tryPos = pos + shiftFrac * labelWidth;
        if (tryPos - labelWidth / 2 < 0) continue;
        if (tryPos + labelWidth / 2 > totalLength) continue;

        const result = getPointAtDistance(points, tryPos);
        if (!result) continue;

        let { angle } = result;
        if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;

        const corners = getRotatedCorners(result.point, obbW, obbH, angle);

        if (placed.some((l) => checkRectanglesIntersect(corners, l.corners))) {
          if (shiftFrac === 0) stats.rejectedByLabel++;
          continue;
        }

        if (intersectsOtherPolylinesIndexed(
          result.point, obbW, obbH, angle, corners, grid, polyline.id
        )) {
          if (shiftFrac === 0) stats.rejectedByPolyline++;
          continue;
        }

        placed.push({
          polylineId: polyline.id,
          text: polyline.label,
          center: result.point,
          angle,
          width: labelWidth,
          height: labelHeight,
          corners,
        });
        stats.placed++;
        break;
      }

      pos += stepDistance;
    }
  }

  stats.durationMs = Math.round(performance.now() - t0);
  return { labels: placed, stats };
}

function intersectsOtherPolylinesIndexed(
  center: Point,
  width: number,
  height: number,
  angle: number,
  corners: Point[],
  grid: SegmentGrid,
  excludeId: string
): boolean {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }
  const candidates = grid.queryBBox(minX, minY, maxX, maxY);

  for (const seg of candidates) {
    if (seg.polylineId === excludeId) continue;
    if (segmentIntersectsOBB(seg.a, seg.b, center, width, height, angle)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// АЛГОРИТМ 2: растровый — битовая маска + Брезенхэм.
//
// Идея (рекомендация научного руководителя):
//   1. Все ломаные растеризуются на битовой маске экранного размера (W·H/8 байт).
//   2. Для каждой подписи проверяем, занят ли её прямоугольник на маске.
//   3. Подпись после размещения тоже закрашивается на маске.
//
// Чтобы подпись не считалась пересечённой со СВОЕЙ ломаной, держим три маски:
//   - maskLines:  все ломаные карты,
//   - maskSelf:   только текущая ломаная (пересоздаётся для каждой),
//   - maskLabels: уже размещённые подписи.
//
// Условие "пиксель занят" = (maskLines AND NOT maskSelf) OR maskLabels.
//
// Сложность:
//   - Растеризация всех ломаных: O(сумма_пикселей_всех_отрезков) ≈ O(M)
//   - Размещение: O(N · K_подписи) где K_подписи ≈ width·height OBB
//   - Итого: O(M + N · K)
//
// На практике каждая операция — это побитовое чтение/запись (1-2 такта),
// без преобразования координат. Гораздо быстрее SAT.
// ─────────────────────────────────────────────────────────────────────────────
export function placeLabelsBitmap(
  polylines: Polyline[],
  opts: PlacementOptions = {}
): PlacementResult {
  const t0 = performance.now();
  const placed: PlacedLabel[] = [];
  const stats: PlacementStats = {
    attempted: 0, placed: 0, rejectedByLabel: 0, rejectedByPolyline: 0,
    durationMs: 0, algorithm: 'bitmap',
  };

  const fontSize = opts.fontSize ?? FONT_SIZE;

  // Размеры маски: либо переданные размеры холста, либо ограниченный bbox ломаных.
  let W = opts.canvasWidth ?? 0;
  let H = opts.canvasHeight ?? 0;
  if (!W || !H) {
    let maxX = 0, maxY = 0;
    for (const pl of polylines) {
      for (const p of pl.points) {
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    W = Math.ceil(maxX) + 100;
    H = Math.ceil(maxY) + 100;
  }

  // Лимит на размер маски, чтобы не упасть на огромном PDF-холсте.
  const MAX_PIXELS = 8_000_000;
  if (W * H > MAX_PIXELS) {
    // Fallback на SAT
    return placeLabelsSAT(polylines, opts);
  }

  const maskLines  = new CollisionMask(W, H);
  const maskLabels = new CollisionMask(W, H);
  const maskSelf   = new CollisionMask(W, H);

  // Растеризуем все ломаные на общей маске
  for (const pl of polylines) {
    maskLines.drawPolyline(pl.points, Math.max(1, Math.round(pl.lineWidth)));
  }

  for (const polyline of polylines) {
    if (!polyline.label.trim() || polyline.points.length < 2) continue;

    // Маска "своих" пикселей — чтобы не считать собственную линию как препятствие
    maskSelf.clearAll();
    maskSelf.drawPolyline(polyline.points, Math.max(1, Math.round(polyline.lineWidth)));

    const points: Point[] =
      polyline.direction === 'reverse'
        ? [...polyline.points].reverse()
        : polyline.points;

    const totalLength = getPolylineLength(points);
    const labelWidth = estimateTextWidth(polyline.label, fontSize) + LABEL_PADDING_X * 2;
    const labelHeight = labelHeightFor(fontSize);
    const obbW = labelWidth + LABEL_MARGIN * 2;
    const obbH = labelHeight + LABEL_MARGIN * 2;

    const periodMultiplier = opts.globalStep ?? (polyline.step + 1);
    const stepDistance = periodMultiplier * labelWidth;
    if (stepDistance < 1) continue;

    let pos = labelWidth / 2;

    while (pos + labelWidth / 2 <= totalLength) {
      stats.attempted++;

      for (const shiftFrac of SHIFT_ATTEMPTS) {
        const tryPos = pos + shiftFrac * labelWidth;
        if (tryPos - labelWidth / 2 < 0) continue;
        if (tryPos + labelWidth / 2 > totalLength) continue;

        const result = getPointAtDistance(points, tryPos);
        if (!result) continue;

        let { angle } = result;
        if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;

        const cx = result.point.x;
        const cy = result.point.y;

        const test = combinedTest(cx, cy, obbW, obbH, angle, maskLines, maskSelf, maskLabels, W, H);

        if (test.hitLabel) {
          if (shiftFrac === 0) stats.rejectedByLabel++;
          continue;
        }
        if (test.hitOther) {
          if (shiftFrac === 0) stats.rejectedByPolyline++;
          continue;
        }

        const corners = getRotatedCorners(result.point, obbW, obbH, angle);
        placed.push({
          polylineId: polyline.id,
          text: polyline.label,
          center: result.point,
          angle,
          width: labelWidth,
          height: labelHeight,
          corners,
        });
        stats.placed++;

        // Запоминаем подпись на маске — следующие подписи её увидят
        maskLabels.fillRotatedRect(cx, cy, obbW, obbH, angle);
        break;
      }

      pos += stepDistance;
    }
  }

  stats.durationMs = Math.round(performance.now() - t0);
  stats.memoryKb = Math.round((maskLines.byteSize * 3) / 1024);
  return { labels: placed, stats };
}

/**
 * Объединённый тест на занятость прямоугольника:
 *   blocked = (maskLines AND NOT maskSelf) OR maskLabels.
 *
 * Возвращает раздельно "попал в чужую линию" и "попал в подпись" — для статистики.
 */
function combinedTest(
  cx: number, cy: number, w: number, h: number, angle: number,
  maskLines: CollisionMask, maskSelf: CollisionMask, maskLabels: CollisionMask,
  maxW: number, maxH: number
): { hitOther: boolean; hitLabel: boolean } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const hw = w / 2;
  const hh = h / 2;

  const ax = Math.abs(cos * hw) + Math.abs(sin * hh);
  const ay = Math.abs(sin * hw) + Math.abs(cos * hh);

  // Keep labels away from canvas edges: use hw (half label width — the largest dimension)
  // as a uniform inset margin. This catches vertical labels on boundary polylines where
  // other lines' endpoint pixels are masked out by maskSelf (shared-pixel false negative).
  if (cx - hw < 0 || cy - hw < 0 || cx + hw >= maxW || cy + hw >= maxH) {
    return { hitOther: true, hitLabel: false };
  }

  const xMin = Math.floor(cx - ax);
  const yMin = Math.floor(cy - ay);
  const xMax = Math.ceil(cx + ax);
  const yMax = Math.ceil(cy + ay);

  let hitOther = false;
  let hitLabel = false;

  for (let py = yMin; py <= yMax; py++) {
    const dy = py - cy;
    for (let px = xMin; px <= xMax; px++) {
      const dx = px - cx;
      const lx =  cos * dx + sin * dy;
      const ly = -sin * dx + cos * dy;
      if (Math.abs(lx) > hw || Math.abs(ly) > hh) continue;

      if (!hitLabel && maskLabels.hasPixel(px, py)) hitLabel = true;
      if (!hitOther && maskLines.hasPixel(px, py) && !maskSelf.hasPixel(px, py)) hitOther = true;
      if (hitOther && hitLabel) return { hitOther, hitLabel };
    }
  }
  return { hitOther, hitLabel };
}
