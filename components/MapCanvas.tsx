'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { Polyline, Point, Tool, PlacedLabel } from '@/lib/types';
import { distanceToPolyline } from '@/lib/geometry';
import { drawScene, SCENE_BG } from '@/lib/renderScene';

interface MapCanvasProps {
  polylines: Polyline[];
  placedLabels: PlacedLabel[];
  tool: Tool;
  selectedId: string | null;
  currentColor: string;
  currentStep: number;
  currentLineWidth: number;
  onPolylineAdded: (p: Polyline) => void;
  onPolylineSelected: (id: string | null) => void;
  onPolylineDeleted: (id: string) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

const DRAW_DASH: number[] = [6, 4];

export default function MapCanvas({
  polylines,
  placedLabels,
  tool,
  selectedId,
  currentColor,
  currentStep,
  currentLineWidth,
  onPolylineAdded,
  onPolylineSelected,
  onPolylineDeleted,
  onCanvasReady,
}: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<Point[]>([]);
  const [mouse, setMouse] = useState<Point | null>(null);

  // Прокидываем ссылку на canvas в родителя, чтобы можно было экспортировать в PDF
  useEffect(() => {
    onCanvasReady?.(canvasRef.current);
    return () => onCanvasReady?.(null);
  }, [onCanvasReady]);

  // ─── рисование ───────────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Используем общую функцию рендера сцены (как и при экспорте в PDF)
    drawScene(ctx, {
      sceneWidth: W,
      sceneHeight: H,
      pixelRatio: 1,
      polylines,
      placedLabels,
      showGrid: true,
      background: SCENE_BG,
      selectedId,
    });

    // ── Превью рисуемой ломаной ───────────────────────────────────────────────
    if (tool === 'draw' && drawing.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentLineWidth;
      ctx.setLineDash(DRAW_DASH);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(drawing[0].x, drawing[0].y);
      for (let i = 1; i < drawing.length; i++) ctx.lineTo(drawing[i].x, drawing[i].y);
      if (mouse) ctx.lineTo(mouse.x, mouse.y);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const p of drawing) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = currentColor;
        ctx.fill();
      }

      // Подсказка
      if (drawing.length >= 2 && mouse) {
        ctx.font = '12px Arial';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'left';
        ctx.fillText('Двойной клик — завершить', mouse.x + 12, mouse.y - 8);
      }
    }
  }, [polylines, placedLabels, tool, selectedId, drawing, mouse, currentColor, currentLineWidth]);

  useEffect(() => { render(); }, [render]);

  // ─── ResizeObserver ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ro = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      render();
    });
    ro.observe(container);
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    return () => ro.disconnect();
  }, [render]);

  // ─── Получить координаты клика ────────────────────────────────────────────
  function getPos(e: React.MouseEvent<HTMLCanvasElement>): Point {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    // Двойной клик обрабатывается в onDoubleClick — игнорируем здесь при count>1
    if (e.detail > 1) return;
    const pos = getPos(e);

    if (tool === 'draw') {
      setDrawing((prev) => [...prev, pos]);
      return;
    }

    // Найти ближайшую ломаную
    let closestId: string | null = null;
    let minD = 10;
    for (const pl of polylines) {
      const d = distanceToPolyline(pos, pl.points);
      if (d < minD) { minD = d; closestId = pl.id; }
    }

    if (tool === 'select') onPolylineSelected(closestId);
    if (tool === 'delete' && closestId) onPolylineDeleted(closestId);
  }

  function handleDoubleClick(_e: React.MouseEvent<HTMLCanvasElement>) {
    if (tool !== 'draw') return;
    if (drawing.length < 2) { setDrawing([]); return; }

    onPolylineAdded({
      id: `pl-${Date.now()}`,
      points: drawing,
      label: `Изолиния ${polylines.length + 1}`,
      color: currentColor,
      step: currentStep,
      direction: 'forward',
      lineWidth: currentLineWidth,
    });
    setDrawing([]);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    setMouse(getPos(e));
  }

  const cursorMap: Record<Tool, string> = {
    draw: 'crosshair',
    select: 'pointer',
    delete: 'not-allowed',
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ cursor: cursorMap[tool] }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMouse(null)}
      />
      {drawing.length === 0 && tool === 'draw' && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/80 text-slate-600 text-xs px-3 py-1 rounded-full shadow">
          Кликайте для добавления точек · Двойной клик — завершить ломаную
        </div>
      )}
    </div>
  );
}
