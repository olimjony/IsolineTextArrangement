import { Point, Polyline } from './types';

export interface IndexedSegment {
  polylineId: string;
  a: Point;
  b: Point;
}

/**
 * Равномерная сетка для быстрого поиска отрезков, попадающих в заданный
 * прямоугольник. Без этого расстановка подписей на реальных картах
 * (десятки тысяч точек) занимала бы десятки секунд.
 */
export class SegmentGrid {
  private cellSize: number;
  private cells = new Map<number, IndexedSegment[]>();
  private cols = 0;

  constructor(cellSize = 50) {
    this.cellSize = cellSize;
  }

  private key(cx: number, cy: number): number {
    return cy * 1_000_003 + cx; // достаточно большой шаг между строками
  }

  build(polylines: Polyline[]): void {
    this.cells.clear();
    for (const pl of polylines) {
      for (let i = 1; i < pl.points.length; i++) {
        this.addSegment(pl.id, pl.points[i - 1], pl.points[i]);
      }
    }
  }

  private addSegment(polylineId: string, a: Point, b: Point): void {
    const seg: IndexedSegment = { polylineId, a, b };
    const minX = Math.min(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxX = Math.max(a.x, b.x);
    const maxY = Math.max(a.y, b.y);

    const cx0 = Math.floor(minX / this.cellSize);
    const cy0 = Math.floor(minY / this.cellSize);
    const cx1 = Math.floor(maxX / this.cellSize);
    const cy1 = Math.floor(maxY / this.cellSize);

    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const k = this.key(cx, cy);
        let list = this.cells.get(k);
        if (!list) { list = []; this.cells.set(k, list); }
        list.push(seg);
      }
    }
    void this.cols; // placeholder
  }

  /** Все отрезки, чьи bbox пересекают данный экранный прямоугольник. */
  queryBBox(minX: number, minY: number, maxX: number, maxY: number): IndexedSegment[] {
    const cx0 = Math.floor(minX / this.cellSize);
    const cy0 = Math.floor(minY / this.cellSize);
    const cx1 = Math.floor(maxX / this.cellSize);
    const cy1 = Math.floor(maxY / this.cellSize);

    const seen = new Set<IndexedSegment>();
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const list = this.cells.get(this.key(cx, cy));
        if (list) for (const s of list) seen.add(s);
      }
    }
    return Array.from(seen);
  }
}
