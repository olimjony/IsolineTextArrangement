import { Point } from './types';

export function dist(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

export function getPolylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += dist(points[i - 1], points[i]);
  }
  return total;
}

/**
 * Возвращает точку и угол на ломаной на расстоянии `d` от начала.
 */
export function getPointAtDistance(
  points: Point[],
  d: number
): { point: Point; angle: number } | null {
  if (points.length < 2) return null;
  let remaining = d;

  for (let i = 1; i < points.length; i++) {
    const segLen = dist(points[i - 1], points[i]);
    if (remaining <= segLen || i === points.length - 1) {
      const t = segLen > 0 ? Math.min(1, remaining / segLen) : 0;
      const point: Point = {
        x: points[i - 1].x + t * (points[i].x - points[i - 1].x),
        y: points[i - 1].y + t * (points[i].y - points[i - 1].y),
      };
      const angle = Math.atan2(
        points[i].y - points[i - 1].y,
        points[i].x - points[i - 1].x
      );
      return { point, angle };
    }
    remaining -= segLen;
  }
  return null;
}

/**
 * Возвращает 4 угла повёрнутого прямоугольника (OBB) через SAT.
 */
export function getRotatedCorners(
  center: Point,
  width: number,
  height: number,
  angle: number
): Point[] {
  const hw = width / 2;
  const hh = height / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const local: [number, number][] = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ];

  return local.map(([lx, ly]) => ({
    x: center.x + lx * cos - ly * sin,
    y: center.y + lx * sin + ly * cos,
  }));
}

function projectPolygon(corners: Point[], axis: Point): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const c of corners) {
    const proj = c.x * axis.x + c.y * axis.y;
    min = Math.min(min, proj);
    max = Math.max(max, proj);
  }
  return { min, max };
}

function getEdgeAxes(corners: Point[]): Point[] {
  const axes: Point[] = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.sqrt(ex * ex + ey * ey) || 1;
    axes.push({ x: -ey / len, y: ex / len });
  }
  return axes;
}

/**
 * Проверка пересечения двух OBB методом разделяющей оси (SAT).
 */
export function checkRectanglesIntersect(corners1: Point[], corners2: Point[]): boolean {
  const axes = [...getEdgeAxes(corners1), ...getEdgeAxes(corners2)];
  for (const axis of axes) {
    const p1 = projectPolygon(corners1, axis);
    const p2 = projectPolygon(corners2, axis);
    if (p1.max < p2.min || p2.max < p1.min) return false;
  }
  return true;
}

/**
 * Расстояние от точки до отрезка.
 */
function distPointToSegment(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq));
  return dist(p, { x: a.x + t * abx, y: a.y + t * aby });
}

/**
 * Минимальное расстояние от точки до ломаной.
 */
export function distanceToPolyline(point: Point, polylinePoints: Point[]): number {
  let minDist = Infinity;
  for (let i = 1; i < polylinePoints.length; i++) {
    minDist = Math.min(minDist, distPointToSegment(point, polylinePoints[i - 1], polylinePoints[i]));
  }
  return minDist;
}
