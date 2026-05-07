import { Polyline, Point } from './types';

const PALETTE = [
  '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c',
  '#0891b2', '#ca8a04', '#be185d', '#0d9488', '#7c3aed',
];

export interface ParseDiagnostics {
  /** Всего "секций" встречено в файле (между --- или при смене значения). */
  totalSections: number;
  /** Секций, превратившихся в ломаную (≥ 2 точки). */
  polylinesCreated: number;
  /** Секций, отброшенных как слишком короткие (0 или 1 точка). */
  sectionsDropped: number;
  /** Подробности отброшенных секций — что именно потерялось. */
  droppedSections: { value: number; pointCount: number; firstPoint?: Point }[];
  /** Всего точек прочитано и положено в ломаные. */
  pointsInPolylines: number;
  /** Точек-sentinel'ов (value < -900) — данные пропущены. */
  sentinelsSkipped: number;
  /** Строк, не прошедших парсинг (меньше 3 токенов или NaN). */
  malformedLines: number;
}

/**
 * Парсер формата руководителя:
 *   value X Y                — точка ломаной с подписью value
 *   ----...                  — разделитель ломаных
 *   value < -900 (например -999.25) — данные пропускаются (sentinel)
 *
 * Все точки в одной "секции" имеют одну и ту же подпись (значение изолинии).
 */
export function parseLinesFile(content: string, opts: { flipY?: boolean } = {}): Polyline[] {
  return parseLinesFileWithDiagnostics(content, opts).polylines;
}

/**
 * То же, что parseLinesFile, но дополнительно возвращает счётчики того,
 * сколько секций/строк было пропущено и почему — для UI-диагностики.
 */
export function parseLinesFileWithDiagnostics(
  content: string,
  opts: { flipY?: boolean } = {}
): { polylines: Polyline[]; diagnostics: ParseDiagnostics } {
  const flipY = opts.flipY ?? true;
  const polylines: Polyline[] = [];
  let current: { value: number; points: Point[] } | null = null;

  const diagnostics: ParseDiagnostics = {
    totalSections: 0,
    polylinesCreated: 0,
    sectionsDropped: 0,
    droppedSections: [],
    pointsInPolylines: 0,
    sentinelsSkipped: 0,
    malformedLines: 0,
  };

  const flush = () => {
    if (!current) return;
    diagnostics.totalSections++;
    if (current.points.length >= 2) {
      polylines.push({
        id: `loaded-${polylines.length}-${Date.now()}`,
        points: current.points,
        label: String(current.value),
        color: PALETTE[polylines.length % PALETTE.length],
        step: 2,
        direction: 'forward',
        lineWidth: 1.5,
      });
      diagnostics.polylinesCreated++;
      diagnostics.pointsInPolylines += current.points.length;
    } else {
      diagnostics.sectionsDropped++;
      diagnostics.droppedSections.push({
        value: current.value,
        pointCount: current.points.length,
        firstPoint: current.points[0],
      });
    }
    current = null;
  };

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    if (/^-{3,}/.test(line)) { flush(); continue; }

    const parts = line.split(/\s+/);
    if (parts.length < 3) { diagnostics.malformedLines++; continue; }

    const value = parseFloat(parts[0]);
    const x = parseFloat(parts[1]);
    let y = parseFloat(parts[2]);
    if (!isFinite(value) || !isFinite(x) || !isFinite(y)) {
      diagnostics.malformedLines++;
      continue;
    }

    // sentinel — пропускаем
    if (value < -900) { diagnostics.sentinelsSkipped++; continue; }

    if (flipY) y = -y;

    if (!current) current = { value, points: [] };
    else if (current.value !== value) { flush(); current = { value, points: [] }; }

    current.points.push({ x, y });
  }
  flush();

  return { polylines, diagnostics };
}

export interface BBox { minX: number; minY: number; maxX: number; maxY: number; }

export function computeBBox(polylines: Polyline[]): BBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let any = false;
  for (const pl of polylines) {
    for (const p of pl.points) {
      any = true;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return any ? { minX, minY, maxX, maxY } : null;
}
