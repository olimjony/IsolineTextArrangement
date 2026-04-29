import { PlacedLabel, Polyline, Point } from './types';
import {
  getPolylineLength,
  getPointAtDistance,
  getRotatedCorners,
  checkRectanglesIntersect,
  segmentIntersectsOBB,
} from './geometry';
import { SegmentGrid } from './spatialIndex';

export const FONT_SIZE = 14; // шрифт по умолчанию
export const FONT_FAMILY = 'Arial, sans-serif';

/** Ширина текста в пикселях для произвольного размера шрифта. */
export function estimateTextWidth(text: string, fontSize: number = FONT_SIZE): number {
  return text.length * 8.2 * (fontSize / FONT_SIZE);
}

export const LABEL_PADDING_X = 4;
export const LABEL_MARGIN = 3;

/** Высота подписи (с небольшим запасом). */
export function labelHeightFor(fontSize: number): number {
  return fontSize + 6;
}

/** Совместимость со старым кодом. */
export const LABEL_HEIGHT = labelHeightFor(FONT_SIZE);

const SHIFT_ATTEMPTS = [0, -0.25, 0.25, -0.5, 0.5, -0.75, 0.75];

export interface PlacementStats {
  attempted: number;
  placed: number;
  rejectedByLabel: number;
  rejectedByPolyline: number;
  durationMs: number;
}

export interface PlacementResult {
  labels: PlacedLabel[];
  stats: PlacementStats;
}

export interface PlacementOptions {
  /** Период повторения подписи в долях её длины. step=2 → расстояние между подписями = 2 длины подписи. */
  globalStep?: number;
  /** Размер шрифта подписи в пикселях. По умолчанию FONT_SIZE. */
  fontSize?: number;
}

/**
 * Расстановка подписей.
 * - Подписи не пересекают друг друга (SAT/OBB).
 * - Подписи не пересекают чужие ломаные (Liang-Barsky на отрезках).
 * - При неудаче пробуется ряд сдвигов вдоль ломаной.
 * - Для скорости используется равномерная сетка отрезков (без неё — секунды на больших картах).
 */
export function placeLabels(
  polylines: Polyline[],
  opts: PlacementOptions = {}
): PlacementResult {
  const t0 = performance.now();
  const placed: PlacedLabel[] = [];
  const stats: PlacementStats = {
    attempted: 0, placed: 0, rejectedByLabel: 0, rejectedByPolyline: 0, durationMs: 0,
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

    // Период повторения: либо глобальный, либо персональный + 1 (старая семантика).
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

        // 1) Коллизия с уже размещёнными подписями
        if (placed.some((l) => checkRectanglesIntersect(corners, l.corners))) {
          if (shiftFrac === 0) stats.rejectedByLabel++;
          continue;
        }

        // 2) Коллизия с чужими ломаными — через spatial index
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
  // bbox OBB по углам — для запроса в индекс
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
