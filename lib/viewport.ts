import { Point, Polyline } from './types';
import { BBox } from './parseLinesFile';

export interface Viewport {
  scale: number; // px на единицу мирового пространства
  panX: number;  // px
  panY: number;  // px
}

export const IDENTITY_VIEWPORT: Viewport = { scale: 1, panX: 0, panY: 0 };

export function worldToScreen(p: Point, vp: Viewport): Point {
  return {
    x: p.x * vp.scale + vp.panX,
    y: p.y * vp.scale + vp.panY,
  };
}

export function screenToWorld(p: Point, vp: Viewport): Point {
  return {
    x: (p.x - vp.panX) / vp.scale,
    y: (p.y - vp.panY) / vp.scale,
  };
}

/**
 * Подобрать масштаб и сдвиг так, чтобы bbox мирового пространства
 * целиком вписался в холст с указанным отступом.
 */
export function fitBBoxToCanvas(
  bbox: BBox,
  canvasW: number,
  canvasH: number,
  padding = 30
): Viewport {
  const bw = bbox.maxX - bbox.minX || 1;
  const bh = bbox.maxY - bbox.minY || 1;
  const scale = Math.min(
    (canvasW - 2 * padding) / bw,
    (canvasH - 2 * padding) / bh
  );
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  return {
    scale,
    panX: canvasW / 2 - cx * scale,
    panY: canvasH / 2 - cy * scale,
  };
}

/**
 * Зум вокруг указанной точки экрана: после изменения масштаба та же мировая точка
 * должна остаться под тем же экранным пикселем.
 */
export function zoomAt(vp: Viewport, screenPoint: Point, factor: number): Viewport {
  const newScale = vp.scale * factor;
  const world = screenToWorld(screenPoint, vp);
  return {
    scale: newScale,
    panX: screenPoint.x - world.x * newScale,
    panY: screenPoint.y - world.y * newScale,
  };
}

/**
 * Преобразовать ломаные из мировых координат в экранные.
 * Используется перед запуском алгоритма расстановки подписей —
 * подписи имеют фиксированный пиксельный размер, поэтому работаем в пикселях.
 */
export function transformPolylines(polylines: Polyline[], vp: Viewport): Polyline[] {
  return polylines.map((pl) => ({
    ...pl,
    points: pl.points.map((p) => worldToScreen(p, vp)),
  }));
}
