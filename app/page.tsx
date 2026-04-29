'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import ControlPanel from '@/components/ControlPanel';
import ExportDialog, { ExportSettings, getPixelSize, getPaperSizeMM } from '@/components/ExportDialog';
import { Polyline, PlacedLabel, Tool } from '@/lib/types';
import { placeLabels, PlacementStats } from '@/lib/labelPlacement';
import { drawScene, SCENE_BG } from '@/lib/renderScene';

// Canvas не рендерится на сервере — SSR отключён
const MapCanvas = dynamic(() => import('@/components/MapCanvas'), { ssr: false });

// ── Пример данных для демонстрации алгоритма ─────────────────────────────────
function buildSample(): Polyline[] {
  return [
    {
      id: 'sample-1',
      label: '100 м',
      color: '#2563eb',
      step: 1,
      direction: 'forward',
      lineWidth: 2,
      points: [
        { x: 60, y: 300 }, { x: 160, y: 260 }, { x: 280, y: 240 },
        { x: 400, y: 250 }, { x: 520, y: 210 }, { x: 640, y: 230 },
        { x: 740, y: 200 },
      ],
    },
    {
      id: 'sample-2',
      label: '200 м',
      color: '#16a34a',
      step: 1,
      direction: 'forward',
      lineWidth: 2,
      points: [
        { x: 60, y: 380 }, { x: 140, y: 340 }, { x: 260, y: 330 },
        { x: 380, y: 360 }, { x: 500, y: 320 }, { x: 620, y: 340 },
        { x: 740, y: 310 },
      ],
    },
    {
      id: 'sample-3',
      label: '300 м',
      color: '#dc2626',
      step: 1,
      direction: 'forward',
      lineWidth: 2,
      points: [
        { x: 60, y: 460 }, { x: 180, y: 420 }, { x: 300, y: 440 },
        { x: 420, y: 410 }, { x: 540, y: 430 }, { x: 660, y: 400 },
        { x: 740, y: 420 },
      ],
    },
    {
      id: 'sample-4',
      label: '150 м',
      color: '#9333ea',
      step: 1.5,
      direction: 'forward',
      lineWidth: 2,
      points: [
        { x: 80, y: 160 }, { x: 200, y: 180 }, { x: 300, y: 140 },
        { x: 420, y: 170 }, { x: 560, y: 130 }, { x: 700, y: 155 },
      ],
    },
    {
      id: 'sample-5',
      label: '250 м',
      color: '#ea580c',
      step: 1,
      direction: 'reverse',
      lineWidth: 2,
      points: [
        { x: 740, y: 500 }, { x: 600, y: 480 }, { x: 460, y: 510 },
        { x: 340, y: 490 }, { x: 200, y: 520 }, { x: 80, y: 500 },
      ],
    },
  ];
}

export default function Home() {
  const [polylines, setPolylines] = useState<Polyline[]>([]);
  const [placedLabels, setPlacedLabels] = useState<PlacedLabel[]>([]);
  const [stats, setStats] = useState<PlacementStats | null>(null);
  const [tool, setTool] = useState<Tool>('draw');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentColor, setCurrentColor] = useState('#2563eb');
  const [currentStep, setCurrentStep] = useState(1);
  const [currentLineWidth, setCurrentLineWidth] = useState(2);

  const clearPlacement = () => { setPlacedLabels([]); setStats(null); };

  const addPolyline = useCallback((pl: Polyline) => {
    setPolylines((prev) => [...prev, pl]);
    clearPlacement();
  }, []);

  const updatePolyline = useCallback((updated: Polyline) => {
    setPolylines((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    clearPlacement();
  }, []);

  const deletePolyline = useCallback((id: string) => {
    setPolylines((prev) => prev.filter((p) => p.id !== id));
    setPlacedLabels((prev) => prev.filter((l) => l.polylineId !== id));
    setSelectedId((s) => (s === id ? null : s));
  }, []);

  const handlePlaceLabels = useCallback(() => {
    const res = placeLabels(polylines);
    setPlacedLabels(res.labels);
    setStats(res.stats);
  }, [polylines]);

  const handleLoadSample = useCallback(() => {
    const sample = buildSample();
    const res = placeLabels(sample);
    setPolylines(sample);
    setPlacedLabels(res.labels);
    setStats(res.stats);
    setSelectedId(null);
  }, []);

  // ── Экспорт в PDF ───────────────────────────────────────────────────────────
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleCanvasReady = useCallback((c: HTMLCanvasElement | null) => {
    canvasElRef.current = c;
  }, []);

  /**
   * Аналог "смены графического контекста" из MFC: создаём отдельный холст с
   * нужным размером и разрешением (DPI), повторяем тот же рендер на нём,
   * и складываем результат в PDF.
   *
   * Сцена вписывается в формат бумаги по принципу "fit-to-page" с сохранением
   * пропорций — на белом фоне.
   */
  const runExport = useCallback(async (settings: ExportSettings) => {
    const screen = canvasElRef.current;
    if (!screen) return;

    setExporting(true);
    try {
      const [paperPxW, paperPxH] = getPixelSize(settings);
      const [paperMMW, paperMMH] = getPaperSizeMM(settings);

      // Сцена — то, что сейчас на экране (в координатах canvas).
      const sceneW = screen.width;
      const sceneH = screen.height;

      // Масштаб "вписать с сохранением пропорций" в пиксельные размеры бумаги.
      const fitScale = Math.min(paperPxW / sceneW, paperPxH / sceneH);
      const renderW = sceneW * fitScale;
      const renderH = sceneH * fitScale;
      const offsetX = (paperPxW - renderW) / 2;
      const offsetY = (paperPxH - renderH) / 2;

      // ── Готовим высокоразрешённый offscreen холст под бумагу ─────────────
      const out = document.createElement('canvas');
      out.width = paperPxW;
      out.height = paperPxH;
      const outCtx = out.getContext('2d');
      if (!outCtx) return;

      // Белые поля бумаги
      outCtx.fillStyle = '#ffffff';
      outCtx.fillRect(0, 0, paperPxW, paperPxH);

      // Сцена в пиксельных единицах с собственным масштабом
      outCtx.save();
      outCtx.translate(offsetX, offsetY);
      outCtx.scale(fitScale, fitScale);

      // Рендерим ту же самую сцену тем же самым кодом — это и есть "смена графического контекста"
      drawScene(outCtx, {
        sceneWidth: sceneW,
        sceneHeight: sceneH,
        pixelRatio: fitScale,
        polylines,
        placedLabels,
        showGrid: settings.showGrid,
        background: settings.showGrid ? SCENE_BG : '#ffffff',
        selectedId: null,
      });

      outCtx.restore();

      // ── Сохраняем в PDF ──────────────────────────────────────────────────
      const { jsPDF } = await import('jspdf');
      const dataUrl = out.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: settings.orientation,
        unit: 'mm',
        format: settings.format === 'Custom'
          ? [paperMMW, paperMMH]
          : settings.format.toLowerCase(),
        compress: true,
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, paperMMW, paperMMH, undefined, 'FAST');
      pdf.save(`${settings.fileName || 'isolines'}.pdf`);

      setExportOpen(false);
    } finally {
      setExporting(false);
    }
  }, [polylines, placedLabels]);

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <main className="flex-1 min-w-0 relative">
        <MapCanvas
          polylines={polylines}
          placedLabels={placedLabels}
          tool={tool}
          selectedId={selectedId}
          currentColor={currentColor}
          currentStep={currentStep}
          currentLineWidth={currentLineWidth}
          onPolylineAdded={addPolyline}
          onPolylineSelected={setSelectedId}
          onPolylineDeleted={deletePolyline}
          onCanvasReady={handleCanvasReady}
        />
      </main>

      <ControlPanel
        polylines={polylines}
        tool={tool}
        selectedId={selectedId}
        currentColor={currentColor}
        currentStep={currentStep}
        currentLineWidth={currentLineWidth}
        labelsPlaced={placedLabels.length > 0}
        stats={stats}
        onToolChange={setTool}
        onColorChange={setCurrentColor}
        onStepChange={setCurrentStep}
        onLineWidthChange={setCurrentLineWidth}
        onPlaceLabels={handlePlaceLabels}
        onClearLabels={() => { setPlacedLabels([]); setStats(null); }}
        onClearAll={() => { setPolylines([]); setPlacedLabels([]); setStats(null); setSelectedId(null); }}
        onLoadSample={handleLoadSample}
        onExportPdf={() => setExportOpen(true)}
        onPolylineUpdate={updatePolyline}
        onPolylineDelete={deletePolyline}
        onPolylineSelect={setSelectedId}
      />

      <ExportDialog
        open={exportOpen}
        onClose={() => !exporting && setExportOpen(false)}
        onExport={runExport}
      />

      {exporting && (
        <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-xl px-6 py-4 shadow-xl flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-700">Рендерим в высоком разрешении...</span>
          </div>
        </div>
      )}
    </div>
  );
}
