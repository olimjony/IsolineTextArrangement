'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ControlPanel from '@/components/ControlPanel';
import { Polyline, PlacedLabel, Tool } from '@/lib/types';
import { placeLabels } from '@/lib/labelPlacement';

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
  const [tool, setTool] = useState<Tool>('draw');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentColor, setCurrentColor] = useState('#2563eb');
  const [currentStep, setCurrentStep] = useState(1);
  const [currentLineWidth, setCurrentLineWidth] = useState(2);

  const addPolyline = useCallback((pl: Polyline) => {
    setPolylines((prev) => [...prev, pl]);
    setPlacedLabels([]);
  }, []);

  const updatePolyline = useCallback((updated: Polyline) => {
    setPolylines((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setPlacedLabels([]);
  }, []);

  const deletePolyline = useCallback((id: string) => {
    setPolylines((prev) => prev.filter((p) => p.id !== id));
    setPlacedLabels((prev) => prev.filter((l) => l.polylineId !== id));
    setSelectedId((s) => (s === id ? null : s));
  }, []);

  const handlePlaceLabels = useCallback(() => {
    setPlacedLabels(placeLabels(polylines));
  }, [polylines]);

  const handleLoadSample = useCallback(() => {
    const sample = buildSample();
    setPolylines(sample);
    setPlacedLabels(placeLabels(sample));
    setSelectedId(null);
  }, []);

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
        onToolChange={setTool}
        onColorChange={setCurrentColor}
        onStepChange={setCurrentStep}
        onLineWidthChange={setCurrentLineWidth}
        onPlaceLabels={handlePlaceLabels}
        onClearLabels={() => setPlacedLabels([])}
        onClearAll={() => { setPolylines([]); setPlacedLabels([]); setSelectedId(null); }}
        onLoadSample={handleLoadSample}
        onPolylineUpdate={updatePolyline}
        onPolylineDelete={deletePolyline}
        onPolylineSelect={setSelectedId}
      />
    </div>
  );
}
