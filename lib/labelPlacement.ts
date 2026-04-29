import { PlacedLabel, Polyline, Point } from './types';
import {
  getPolylineLength,
  getPointAtDistance,
  getRotatedCorners,
  checkRectanglesIntersect,
  segmentIntersectsOBB,
} from './geometry';

export const FONT_SIZE = 14;
export const FONT_FAMILY = 'Arial, sans-serif';

/**
 * Оцениваем ширину текста. При рендере используем ctx.measureText для точного значения,
 * здесь — приближённое значение для расчёта позиций.
 */
export function estimateTextWidth(text: string): number {
  return text.length * 8.2;
}

export const LABEL_HEIGHT = FONT_SIZE + 6;
export const LABEL_PADDING_X = 4;

/** Запас вокруг подписи, чтобы ломаные не "касались" букв. */
export const LABEL_MARGIN = 3;

/**
 * Сдвиги позиции-кандидата (в долях labelWidth), если базовая позиция не подошла.
 * 0 — сначала пробуем без сдвига, затем чередуем + и − с растущей амплитудой.
 */
const SHIFT_ATTEMPTS = [0, -0.25, 0.25, -0.5, 0.5, -0.75, 0.75];

export interface PlacementStats {
  attempted: number; // сколько позиций-кандидатов было рассмотрено
  placed: number;    // сколько подписей реально поставили
  rejectedByLabel: number;    // сколько отклонено из-за пересечения с другими подписями
  rejectedByPolyline: number; // сколько отклонено из-за пересечения с чужими ломаными
}

export interface PlacementResult {
  labels: PlacedLabel[];
  stats: PlacementStats;
}

/**
 * Основной алгоритм расстановки подписей на ломаных.
 *
 * Коллизии проверяются в двух измерениях:
 *   1. Подпись ↔ подпись (SAT на OBB).
 *   2. Подпись ↔ чужая ломаная (Liang-Barsky в локальной СК OBB).
 *
 * Если базовая позиция не подходит, пробуется ряд сдвигов вдоль ломаной.
 */
export function placeLabels(polylines: Polyline[]): PlacementResult {
  const placed: PlacedLabel[] = [];
  const stats: PlacementStats = {
    attempted: 0, placed: 0, rejectedByLabel: 0, rejectedByPolyline: 0,
  };

  for (const polyline of polylines) {
    if (!polyline.label.trim() || polyline.points.length < 2) continue;

    const points: Point[] =
      polyline.direction === 'reverse'
        ? [...polyline.points].reverse()
        : polyline.points;

    const totalLength = getPolylineLength(points);
    const labelWidth = estimateTextWidth(polyline.label) + LABEL_PADDING_X * 2;
    const labelHeight = LABEL_HEIGHT;
    const obbW = labelWidth + LABEL_MARGIN * 2;
    const obbH = labelHeight + LABEL_MARGIN * 2;

    const stepDistance = (polyline.step + 1) * labelWidth;

    let pos = labelWidth / 2;

    while (pos + labelWidth / 2 <= totalLength) {
      stats.attempted++;

      let settled = false;

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
        const hitLabel = placed.some((l) =>
          checkRectanglesIntersect(corners, l.corners)
        );
        if (hitLabel) { if (shiftFrac === 0) stats.rejectedByLabel++; continue; }

        // 2) Коллизия с чужими ломаными
        const hitPolyline = intersectsOtherPolylines(
          result.point, obbW, obbH, angle, polylines, polyline.id
        );
        if (hitPolyline) { if (shiftFrac === 0) stats.rejectedByPolyline++; continue; }

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
        settled = true;
        break;
      }

      // void (подавление unused-variable lint — settled нужен для отладки)
      void settled;

      pos += stepDistance;
    }
  }

  return { labels: placed, stats };
}

/**
 * Проверка: OBB подписи пересекает хотя бы один отрезок любой ЧУЖОЙ ломаной.
 * Ломаная, на которой стоит подпись (excludeId), пропускается — её разрывает рендер.
 */
function intersectsOtherPolylines(
  center: Point,
  width: number,
  height: number,
  angle: number,
  polylines: Polyline[],
  excludeId: string
): boolean {
  for (const pl of polylines) {
    if (pl.id === excludeId) continue;
    for (let i = 1; i < pl.points.length; i++) {
      if (
        segmentIntersectsOBB(
          pl.points[i - 1], pl.points[i],
          center, width, height, angle
        )
      ) {
        return true;
      }
    }
  }
  return false;
}
