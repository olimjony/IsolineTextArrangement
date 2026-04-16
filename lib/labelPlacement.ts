import { PlacedLabel, Polyline } from './types';
import {
  getPolylineLength,
  getPointAtDistance,
  getRotatedCorners,
  checkRectanglesIntersect,
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

/**
 * Основной алгоритм расстановки подписей на ломаных.
 *
 * Для каждой ломаной:
 *  1. Вычисляем полную длину.
 *  2. Начинаем с позиции labelWidth/2, шагаем через stepDistance = (step+1)*labelWidth.
 *  3. В каждой позиции находим точку и угол на ломаной.
 *  4. Нормализуем угол (текст никогда не вверх ногами).
 *  5. Строим повёрнутый прямоугольник (OBB) подписи.
 *  6. Проверяем пересечение с уже размещёнными подписями через SAT.
 *  7. Если пересечений нет — размещаем.
 */
export function placeLabels(polylines: Polyline[]): PlacedLabel[] {
  const placed: PlacedLabel[] = [];

  for (const polyline of polylines) {
    if (!polyline.label.trim() || polyline.points.length < 2) continue;

    const points =
      polyline.direction === 'reverse'
        ? [...polyline.points].reverse()
        : polyline.points;

    const totalLength = getPolylineLength(points);
    const labelWidth = estimateTextWidth(polyline.label) + LABEL_PADDING_X * 2;
    const labelHeight = LABEL_HEIGHT;

    // Шаг: (step + 1) * labelWidth, чтобы step=1 означал "одна длина надписи между надписями"
    const stepDistance = (polyline.step + 1) * labelWidth;

    let pos = labelWidth / 2;

    while (pos + labelWidth / 2 <= totalLength) {
      const result = getPointAtDistance(points, pos);

      if (result) {
        let { angle } = result;

        // Нормализация: текст читается слева направо
        if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
          angle += Math.PI;
        }

        const corners = getRotatedCorners(result.point, labelWidth, labelHeight, angle);

        const intersects = placed.some((l) =>
          checkRectanglesIntersect(corners, l.corners)
        );

        if (!intersects) {
          placed.push({
            polylineId: polyline.id,
            text: polyline.label,
            center: result.point,
            angle,
            width: labelWidth,
            height: labelHeight,
            corners,
          });
        }
      }

      pos += stepDistance;
    }
  }

  return placed;
}
