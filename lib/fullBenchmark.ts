import { Polyline } from './types';
import { placeLabels, PlacementAlgorithm } from './labelPlacement';
import { Viewport, transformPolylines, fitBBoxToCanvas } from './viewport';
import { computeBBox } from './parseLinesFile';

export interface FullBenchmarkRow {
  scalePercent: number;
  algorithmRequested: PlacementAlgorithm;
  algorithmActual: PlacementAlgorithm;
  fellBack: boolean;
  attempted: number;
  placed: number;
  rejectedByLabel: number;
  rejectedByPolyline: number;
  durationMs: number;
  memoryKb?: number;
  successRate: number;
  labelsPerMs: number;
}

export interface FullBenchmarkMeta {
  polylineCount: number;
  pointCount: number;
  canvasW: number;
  canvasH: number;
  globalStep: number;
  globalFontSize: number;
  globalLineWidth: number | null;
  fitScale: number;
  timestamp: string;
}

export interface FullBenchmarkResult {
  rows: FullBenchmarkRow[];
  meta: FullBenchmarkMeta;
}

export interface FullBenchmarkOptions {
  globalStep: number;
  globalFontSize: number;
  globalLineWidth: number | null;
  scales: number[];
  onProgress?: (done: number, total: number, label: string) => void;
}

/**
 * Прогон бенчмарка по списку масштабов и обоим алгоритмам.
 * Не меняет внешний viewport — масштаб применяется виртуально для каждой ячейки.
 */
export async function runFullBenchmark(
  polylines: Polyline[],
  canvasW: number,
  canvasH: number,
  opts: FullBenchmarkOptions
): Promise<FullBenchmarkResult> {
  const bbox = computeBBox(polylines);
  if (!bbox) throw new Error('Карта пуста — нечего тестировать.');
  if (canvasW <= 0 || canvasH <= 0) throw new Error('Холст имеет нулевой размер.');

  const fitVp = fitBBoxToCanvas(bbox, canvasW, canvasH);
  const fitScale = fitVp.scale;

  // Применяем глобальную толщину линий, если задана — иначе используем индивидуальную из ломаных.
  const polysForBench: Polyline[] = opts.globalLineWidth !== null
    ? polylines.map((pl) => ({ ...pl, lineWidth: opts.globalLineWidth! }))
    : polylines;

  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;

  const algorithms: PlacementAlgorithm[] = ['bitmap', 'sat'];
  const total = opts.scales.length * algorithms.length;
  let done = 0;
  const rows: FullBenchmarkRow[] = [];

  for (const scalePercent of opts.scales) {
    const scale = fitScale * (scalePercent / 100);
    const vp: Viewport = {
      scale,
      panX: canvasW / 2 - cx * scale,
      panY: canvasH / 2 - cy * scale,
    };
    const screenPolylines = transformPolylines(polysForBench, vp);

    for (const algo of algorithms) {
      // отдаём управление UI: даём перерисовать прогресс перед тяжёлой итерацией
      await new Promise((r) => setTimeout(r, 0));
      opts.onProgress?.(done, total, `${scalePercent}% · ${algo}`);

      const res = placeLabels(screenPolylines, {
        globalStep: opts.globalStep,
        fontSize: opts.globalFontSize,
        algorithm: algo,
        canvasWidth: canvasW,
        canvasHeight: canvasH,
      });

      const stats = res.stats;
      const fellBack = algo === 'bitmap' && stats.algorithm === 'sat';

      rows.push({
        scalePercent,
        algorithmRequested: algo,
        algorithmActual: stats.algorithm,
        fellBack,
        attempted: stats.attempted,
        placed: stats.placed,
        rejectedByLabel: stats.rejectedByLabel,
        rejectedByPolyline: stats.rejectedByPolyline,
        durationMs: stats.durationMs,
        memoryKb: stats.memoryKb,
        successRate: stats.attempted > 0 ? (stats.placed / stats.attempted) * 100 : 0,
        labelsPerMs: stats.durationMs > 0 ? stats.placed / stats.durationMs : 0,
      });

      done++;
      opts.onProgress?.(done, total, `${scalePercent}% · ${algo}`);
    }
  }

  let pointCount = 0;
  for (const pl of polylines) pointCount += pl.points.length;

  return {
    rows,
    meta: {
      polylineCount: polylines.length,
      pointCount,
      canvasW,
      canvasH,
      globalStep: opts.globalStep,
      globalFontSize: opts.globalFontSize,
      globalLineWidth: opts.globalLineWidth,
      fitScale,
      timestamp: new Date().toLocaleString('ru-RU'),
    },
  };
}

// ── Экспорт результатов ─────────────────────────────────────────────────────

export function toCsv(result: FullBenchmarkResult): string {
  const m = result.meta;
  // BOM (U+FEFF) — чтобы Excel/Numbers под Windows распознали кодировку как UTF-8
  // и кириллица в шапке не превращалась в "ÐÐµÐ½ÑÐ¼Ð°ÑÐº".
  const BOM = '﻿';
  const headerLines = [
    `# Бенчмарк размещения подписей · ${m.timestamp}`,
    `# Ломаных: ${m.polylineCount}, точек: ${m.pointCount}`,
    `# Холст (одинаков для всех строк): ${m.canvasW}x${m.canvasH} px, fit_scale=${m.fitScale.toFixed(4)}`,
    `# globalStep=${m.globalStep}, fontSize=${m.globalFontSize}px, lineWidth=${m.globalLineWidth ?? 'individual'}`,
    '',
  ];
  const cols = [
    'scale_percent', 'algorithm_requested', 'fell_back',
    'attempted', 'placed', 'success_rate_pct',
    'rejected_by_label', 'rejected_by_polyline',
    'duration_ms', 'memory_kb', 'labels_per_ms',
  ];
  const lines = [cols.join(',')];
  for (const r of result.rows) {
    lines.push([
      r.scalePercent,
      r.algorithmRequested,
      r.fellBack ? 'true' : 'false',
      r.attempted,
      r.placed,
      r.successRate.toFixed(2),
      r.rejectedByLabel,
      r.rejectedByPolyline,
      r.durationMs,
      r.memoryKb ?? '',
      r.labelsPerMs.toFixed(3),
    ].join(','));
  }
  return BOM + headerLines.join('\n') + lines.join('\n') + '\n';
}

export function toMarkdown(result: FullBenchmarkResult): string {
  const m = result.meta;
  const lw = m.globalLineWidth === null ? 'индивид.' : `${m.globalLineWidth}px`;
  let md = `## Бенчмарк размещения подписей\n\n`;
  md += `- **Дата:** ${m.timestamp}\n`;
  md += `- **Ломаных:** ${m.polylineCount}, **точек:** ${m.pointCount}\n`;
  md += `- **Холст:** ${m.canvasW}×${m.canvasH} px (fit scale = ${m.fitScale.toFixed(4)})\n`;
  md += `- **Параметры:** globalStep = ${m.globalStep}, fontSize = ${m.globalFontSize}px, lineWidth = ${lw}\n\n`;
  md += `| Масштаб | Алгоритм | Попыток | Размещено | Успех, % | Откл. подп. | Откл. лин. | Время, мс | Память, КБ | Подп./мс |\n`;
  md += `|--------:|:---------|--------:|----------:|---------:|------------:|-----------:|----------:|-----------:|---------:|\n`;
  for (const r of result.rows) {
    const algo = r.algorithmRequested === 'bitmap' ? 'Растровый' : 'SAT';
    const algoCell = r.fellBack ? `${algo} → SAT (fallback)` : algo;
    const mem = r.memoryKb !== undefined ? r.memoryKb : '—';
    md += `| ${r.scalePercent}% | ${algoCell} | ${r.attempted} | ${r.placed} | ${r.successRate.toFixed(1)} | ${r.rejectedByLabel} | ${r.rejectedByPolyline} | ${r.durationMs} | ${mem} | ${r.labelsPerMs.toFixed(2)} |\n`;
  }
  return md;
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
