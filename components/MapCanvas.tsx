'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { Polyline, Point, Tool, PlacedLabel } from '@/lib/types';
import { distanceToPolyline } from '@/lib/geometry';
import { drawScene, SCENE_BG, ColorMode } from '@/lib/renderScene';
import {
  Viewport, worldToScreen, screenToWorld, transformPolylines, zoomAt,
} from '@/lib/viewport';

interface MapCanvasProps {
  polylines: Polyline[];          // в МИРОВЫХ координатах
  placedLabels: PlacedLabel[];    // в ЭКРАННЫХ координатах
  tool: Tool;
  selectedId: string | null;
  currentColor: string;
  currentStep: number;
  currentLineWidth: number;
  viewport: Viewport;
  showGrid: boolean;
  fontSize: number;
  lineWidthOverride?: number;
  colorMode: ColorMode;
  singleColor: string;
  onPolylineAdded: (p: Polyline) => void;
  onPolylineSelected: (id: string | null) => void;
  onPolylineDeleted: (id: string) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  onViewportChange: (vp: Viewport) => void;
  onCanvasSize?: (w: number, h: number) => void;
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
  viewport,
  showGrid,
  fontSize,
  lineWidthOverride,
  colorMode,
  singleColor,
  onPolylineAdded,
  onPolylineSelected,
  onPolylineDeleted,
  onCanvasReady,
  onViewportChange,
  onCanvasSize,
}: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawingWorld, setDrawingWorld] = useState<Point[]>([]);
  const [mouse, setMouse] = useState<Point | null>(null);
  const [pan, setPan] = useState<{ startScreen: Point; startVp: Viewport } | null>(null);

  useEffect(() => {
    onCanvasReady?.(canvasRef.current);
    return () => onCanvasReady?.(null);
  }, [onCanvasReady]);

  // ─── Render ────────────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Полилинии в экранных координатах
    const screenPolylines = transformPolylines(polylines, viewport);

    drawScene(ctx, {
      sceneWidth: W,
      sceneHeight: H,
      pixelRatio: 1,
      polylines: screenPolylines,
      placedLabels,
      showGrid,
      background: SCENE_BG,
      selectedId,
      fontSize,
      lineWidthOverride,
      colorMode,
      singleColor,
    });

    // Превью рисуемой ломаной
    if (tool === 'draw' && drawingWorld.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentLineWidth;
      ctx.setLineDash(DRAW_DASH);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const screenPts = drawingWorld.map((p) => worldToScreen(p, viewport));
      ctx.moveTo(screenPts[0].x, screenPts[0].y);
      for (let i = 1; i < screenPts.length; i++) ctx.lineTo(screenPts[i].x, screenPts[i].y);
      if (mouse) ctx.lineTo(mouse.x, mouse.y);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const p of screenPts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = currentColor;
        ctx.fill();
      }
    }
  }, [polylines, placedLabels, tool, selectedId, drawingWorld, mouse, currentColor, currentLineWidth, viewport, showGrid, fontSize, lineWidthOverride, colorMode, singleColor]);

  useEffect(() => { render(); }, [render]);

  // ─── ResizeObserver: подгоняем canvas под контейнер ───────────────────────
  // Зависимостей быть не должно — observer создаём один раз.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const apply = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      onCanvasSize?.(w, h);
    };
    const ro = new ResizeObserver(apply);
    ro.observe(container);
    apply();
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Координаты мыши ────────────────────────────────────────────────────────
  function getScreenPos(e: React.MouseEvent | React.WheelEvent): Point {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ─── Клик ───────────────────────────────────────────────────────────────────
  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.detail > 1) return;
    if (pan) return;
    const screen = getScreenPos(e);

    if (tool === 'draw') {
      setDrawingWorld((prev) => [...prev, screenToWorld(screen, viewport)]);
      return;
    }

    // Поиск ближайшей ломаной — переводим точку в мир и считаем расстояние в мировых единицах
    const world = screenToWorld(screen, viewport);
    const thresholdWorld = 10 / viewport.scale;
    let closestId: string | null = null;
    let minD = thresholdWorld;
    for (const pl of polylines) {
      const d = distanceToPolyline(world, pl.points);
      if (d < minD) { minD = d; closestId = pl.id; }
    }

    if (tool === 'select') onPolylineSelected(closestId);
    if (tool === 'delete' && closestId) onPolylineDeleted(closestId);
  }

  function handleDoubleClick() {
    if (tool !== 'draw') return;
    if (drawingWorld.length < 2) { setDrawingWorld([]); return; }

    onPolylineAdded({
      id: `pl-${Date.now()}`,
      points: drawingWorld,
      label: `Изолиния ${polylines.length + 1}`,
      color: currentColor,
      step: currentStep,
      direction: 'forward',
      lineWidth: currentLineWidth,
    });
    setDrawingWorld([]);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const screen = getScreenPos(e);
    setMouse(screen);
    if (pan) {
      onViewportChange({
        scale: pan.startVp.scale,
        panX: pan.startVp.panX + (screen.x - pan.startScreen.x),
        panY: pan.startVp.panY + (screen.y - pan.startScreen.y),
      });
    }
  }

  // Пан правой/средней кнопкой
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      setPan({ startScreen: getScreenPos(e), startVp: viewport });
    }
  }
  function handleMouseUp() { setPan(null); }
  function handleContextMenu(e: React.MouseEvent) { e.preventDefault(); }

  // Зум колесом
  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    onViewportChange(zoomAt(viewport, getScreenPos(e), factor));
  }

  const cursorMap: Record<Tool, string> = {
    draw: 'crosshair',
    select: 'pointer',
    delete: 'not-allowed',
  };
  const cursor = pan ? 'grabbing' : cursorMap[tool];

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="block w-full h-full select-none"
        style={{ cursor }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setMouse(null); setPan(null); }}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
      />
      {drawingWorld.length === 0 && tool === 'draw' && polylines.length === 0 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/80 text-slate-600 text-xs px-3 py-1 rounded-full shadow">
          Кликайте для добавления точек · Двойной клик — завершить · ПКМ/средняя — панорама · Колесо — зум
        </div>
      )}
    </div>
  );
}
