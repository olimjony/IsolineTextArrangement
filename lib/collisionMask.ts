import { Point } from './types';

/**
 * Битовая маска коллизий W×H пикселей с упаковкой 8 пикселей в один байт.
 *
 * Идея алгоритма (рекомендация научного руководителя):
 *   1. Все ломаные прорисовываются на маске алгоритмом Брезенхэма — O(M пикселей).
 *   2. Для каждой подписи проверяется, занят ли её прямоугольник — O(K пикселей подписи).
 *   3. После размещения подпись закрашивается на маске — следующие учитывают её автоматически.
 *
 * Итоговая сложность размещения: O(M + N + K), где K = общее число обработанных пикселей.
 * Каждая операция — это побитовое чтение/запись, без преобразования координат.
 */
export class CollisionMask {
  readonly width: number;
  readonly height: number;
  private bits: Uint8Array;

  constructor(width: number, height: number) {
    this.width = Math.max(1, Math.ceil(width));
    this.height = Math.max(1, Math.ceil(height));
    this.bits = new Uint8Array(Math.ceil((this.width * this.height) / 8));
  }

  clearAll(): void {
    this.bits.fill(0);
  }

  setPixel(x: number, y: number): void {
    if (x < 0 || y < 0) return;
    const ix = x | 0;
    const iy = y | 0;
    if (ix >= this.width || iy >= this.height) return;
    const idx = iy * this.width + ix;
    this.bits[idx >> 3] |= 1 << (idx & 7);
  }

  hasPixel(x: number, y: number): boolean {
    if (x < 0 || y < 0) return false;
    const ix = x | 0;
    const iy = y | 0;
    if (ix >= this.width || iy >= this.height) return false;
    const idx = iy * this.width + ix;
    return (this.bits[idx >> 3] & (1 << (idx & 7))) !== 0;
  }

  /**
   * Алгоритм Брезенхэма для отрезка (x0,y0)-(x1,y1).
   * Толщина >1 эмулируется штампом квадратиком вокруг каждого пикселя.
   */
  drawLine(x0: number, y0: number, x1: number, y1: number, thickness: number = 1): void {
    let cx = Math.round(x0);
    let cy = Math.round(y0);
    const ex = Math.round(x1);
    const ey = Math.round(y1);

    const dx = Math.abs(ex - cx);
    const dy = Math.abs(ey - cy);
    const sx = cx < ex ? 1 : -1;
    const sy = cy < ey ? 1 : -1;
    let err = dx - dy;

    const r = Math.max(0, Math.floor(thickness / 2));

    while (true) {
      if (r === 0) {
        this.setPixel(cx, cy);
      } else {
        for (let oy = -r; oy <= r; oy++) {
          for (let ox = -r; ox <= r; ox++) {
            this.setPixel(cx + ox, cy + oy);
          }
        }
      }

      if (cx === ex && cy === ey) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 <  dx) { err += dx; cy += sy; }
    }
  }

  drawPolyline(points: Point[], thickness: number = 1): void {
    if (points.length < 2) return;
    for (let i = 1; i < points.length; i++) {
      this.drawLine(
        points[i - 1].x, points[i - 1].y,
        points[i].x,     points[i].y,
        thickness
      );
    }
  }

  /** Закрасить повёрнутый прямоугольник (OBB) — обходим AABB и проверяем point-in-OBB. */
  fillRotatedRect(cx: number, cy: number, w: number, h: number, angle: number): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const hw = w / 2;
    const hh = h / 2;

    const ax = Math.abs(cos * hw) + Math.abs(sin * hh);
    const ay = Math.abs(sin * hw) + Math.abs(cos * hh);
    const xMin = Math.max(0, Math.floor(cx - ax));
    const yMin = Math.max(0, Math.floor(cy - ay));
    const xMax = Math.min(this.width - 1,  Math.ceil(cx + ax));
    const yMax = Math.min(this.height - 1, Math.ceil(cy + ay));

    for (let py = yMin; py <= yMax; py++) {
      const dy = py - cy;
      for (let px = xMin; px <= xMax; px++) {
        const dx = px - cx;
        const lx =  cos * dx + sin * dy;
        const ly = -sin * dx + cos * dy;
        if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) {
          this.setPixel(px, py);
        }
      }
    }
  }

  /** Есть ли занятый пиксель внутри OBB? Ранний выход на первом совпадении. */
  testRotatedRect(cx: number, cy: number, w: number, h: number, angle: number): boolean {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const hw = w / 2;
    const hh = h / 2;

    const ax = Math.abs(cos * hw) + Math.abs(sin * hh);
    const ay = Math.abs(sin * hw) + Math.abs(cos * hh);
    const xMin = Math.max(0, Math.floor(cx - ax));
    const yMin = Math.max(0, Math.floor(cy - ay));
    const xMax = Math.min(this.width - 1,  Math.ceil(cx + ax));
    const yMax = Math.min(this.height - 1, Math.ceil(cy + ay));

    for (let py = yMin; py <= yMax; py++) {
      const dy = py - cy;
      for (let px = xMin; px <= xMax; px++) {
        const dx = px - cx;
        const lx =  cos * dx + sin * dy;
        const ly = -sin * dx + cos * dy;
        if (Math.abs(lx) <= hw && Math.abs(ly) <= hh && this.hasPixel(px, py)) {
          return true;
        }
      }
    }
    return false;
  }

  get byteSize(): number { return this.bits.length; }
}
