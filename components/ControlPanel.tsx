'use client';

import { Polyline, Tool } from '@/lib/types';
import { PlacementStats } from '@/lib/labelPlacement';

const PALETTE = [
  '#2563eb', '#dc2626', '#16a34a', '#9333ea',
  '#ea580c', '#0891b2', '#ca8a04', '#be185d',
];

interface ControlPanelProps {
  polylines: Polyline[];
  tool: Tool;
  selectedId: string | null;
  currentColor: string;
  currentStep: number;
  currentLineWidth: number;
  labelsPlaced: boolean;
  stats: PlacementStats | null;
  onToolChange: (t: Tool) => void;
  onColorChange: (c: string) => void;
  onStepChange: (s: number) => void;
  onLineWidthChange: (w: number) => void;
  onPlaceLabels: () => void;
  onClearLabels: () => void;
  onClearAll: () => void;
  onLoadSample: () => void;
  onExportPdf: () => void;
  onPolylineUpdate: (p: Polyline) => void;
  onPolylineDelete: (id: string) => void;
  onPolylineSelect: (id: string | null) => void;
}

export default function ControlPanel({
  polylines,
  tool,
  selectedId,
  currentColor,
  currentStep,
  currentLineWidth,
  labelsPlaced,
  stats,
  onToolChange,
  onColorChange,
  onStepChange,
  onLineWidthChange,
  onPlaceLabels,
  onClearLabels,
  onClearAll,
  onLoadSample,
  onExportPdf,
  onPolylineUpdate,
  onPolylineDelete,
  onPolylineSelect,
}: ControlPanelProps) {
  return (
    <aside className="w-72 min-w-[17rem] bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      {/* Заголовок */}
      <div className="bg-slate-800 text-white px-4 py-3">
        <h1 className="font-semibold text-sm">Подписи на изолиниях</h1>
        <p className="text-slate-400 text-xs mt-0.5">Векторная карта</p>
      </div>

      <div className="overflow-y-auto flex-1 p-3 space-y-4">
        {/* Инструменты */}
        <Section title="Инструмент">
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { id: 'draw', icon: '✏️', label: 'Рисовать' },
              { id: 'select', icon: '🔲', label: 'Выбрать' },
              { id: 'delete', icon: '🗑️', label: 'Удалить' },
            ] as { id: Tool; icon: string; label: string }[]).map((t) => (
              <button
                key={t.id}
                onClick={() => onToolChange(t.id)}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs border transition-all
                  ${tool === t.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <span className="text-base">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Цвет */}
        <Section title="Цвет новой линии">
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => onColorChange(c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110
                  ${currentColor === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <label className="flex items-center gap-2 mt-2">
            <span className="text-xs text-slate-500">Другой:</span>
            <input
              type="color"
              value={currentColor}
              onChange={(e) => onColorChange(e.target.value)}
              className="w-8 h-7 rounded cursor-pointer border border-slate-200"
            />
          </label>
        </Section>

        {/* Параметры по умолчанию */}
        <Section title="Параметры новых линий">
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Шаг вывода: <span className="font-medium text-slate-800">{currentStep}</span>
            <input
              type="range" min={0} max={5} step={0.5}
              value={currentStep}
              onChange={(e) => onStepChange(+e.target.value)}
              className="accent-blue-500"
            />
            <span className="text-slate-400">0 = вплотную · 1 = одна длина между надписями</span>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600 mt-2">
            Толщина линии: <span className="font-medium text-slate-800">{currentLineWidth}px</span>
            <input
              type="range" min={1} max={8}
              value={currentLineWidth}
              onChange={(e) => onLineWidthChange(+e.target.value)}
              className="accent-blue-500"
            />
          </label>
        </Section>

        {/* Статистика размещения */}
        {stats && (
          <Section title="Статистика размещения">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1 text-xs">
              <StatRow label="Попыток" value={stats.attempted} />
              <StatRow label="Размещено" value={stats.placed} color="text-green-700" />
              <StatRow
                label="Отклонено (подписи)"
                value={stats.rejectedByLabel}
                color="text-orange-700"
              />
              <StatRow
                label="Отклонено (линии)"
                value={stats.rejectedByPolyline}
                color="text-red-700"
              />
            </div>
          </Section>
        )}

        {/* Кнопки действий */}
        <Section title="Действия">
          <div className="space-y-1.5">
            <button
              onClick={onPlaceLabels}
              disabled={polylines.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                         text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              Расставить подписи
            </button>
            {labelsPlaced && (
              <button
                onClick={onClearLabels}
                className="w-full border border-slate-300 hover:bg-slate-50 text-slate-700
                           text-sm py-2 rounded-lg transition-colors"
              >
                Убрать подписи
              </button>
            )}
            <button
              onClick={onLoadSample}
              className="w-full border border-green-300 hover:bg-green-50 text-green-700
                         text-sm py-2 rounded-lg transition-colors"
            >
              Загрузить пример
            </button>
            <button
              onClick={onExportPdf}
              disabled={polylines.length === 0}
              className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed
                         text-white text-sm font-medium py-2 rounded-lg transition-colors
                         flex items-center justify-center gap-1.5"
            >
              <span>📄</span> Экспорт в PDF
            </button>
            <button
              onClick={onClearAll}
              disabled={polylines.length === 0}
              className="w-full border border-red-200 hover:bg-red-50 text-red-600
                         text-sm py-2 rounded-lg transition-colors disabled:opacity-40"
            >
              Очистить всё
            </button>
          </div>
        </Section>

        {/* Список ломаных */}
        {polylines.length > 0 && (
          <Section title={`Линии (${polylines.length})`}>
            <div className="space-y-2">
              {polylines.map((pl) => (
                <PolylineCard
                  key={pl.id}
                  polyline={pl}
                  selected={pl.id === selectedId}
                  onSelect={() => onPolylineSelect(pl.id === selectedId ? null : pl.id)}
                  onUpdate={onPolylineUpdate}
                  onDelete={() => onPolylineDelete(pl.id)}
                />
              ))}
            </div>
          </Section>
        )}

        {polylines.length === 0 && (
          <div className="text-center text-slate-400 text-sm py-6 border-2 border-dashed border-slate-200 rounded-xl">
            <div className="text-3xl mb-2">🗺️</div>
            Нарисуйте ломаные или загрузите пример
          </div>
        )}
      </div>

      {/* Статус */}
      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400 bg-slate-50">
        {polylines.length} линий · Алгоритм: SAT (OBB)
      </div>
    </aside>
  );
}

// ── Вспомогательные компоненты ────────────────────────────────────────────────

function StatRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold tabular-nums ${color ?? 'text-slate-800'}`}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        {title}
      </h2>
      {children}
    </div>
  );
}

function PolylineCard({
  polyline,
  selected,
  onSelect,
  onUpdate,
  onDelete,
}: {
  polyline: Polyline;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (p: Polyline) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`rounded-lg border p-2 transition-all cursor-pointer
        ${selected ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ background: polyline.color }}
        />
        <input
          className="flex-1 text-xs font-medium bg-transparent outline-none border-b border-transparent
                     hover:border-slate-300 focus:border-blue-400 px-0.5 transition-colors"
          value={polyline.label}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onUpdate({ ...polyline, label: e.target.value })}
          placeholder="Подпись..."
        />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-slate-300 hover:text-red-500 transition-colors text-xs"
          title="Удалить"
        >✕</button>
      </div>

      {selected && (
        <div className="space-y-1.5 pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
          <label className="flex items-center justify-between text-xs text-slate-600">
            <span>Направление</span>
            <select
              value={polyline.direction}
              onChange={(e) => onUpdate({ ...polyline, direction: e.target.value as 'forward' | 'reverse' })}
              className="text-xs border border-slate-200 rounded px-1 py-0.5 bg-white"
            >
              <option value="forward">Прямое →</option>
              <option value="reverse">Обратное ←</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-slate-600">
            <span>Шаг: <strong>{polyline.step}</strong></span>
            <input
              type="range" min={0} max={5} step={0.5}
              value={polyline.step}
              onChange={(e) => onUpdate({ ...polyline, step: +e.target.value })}
              className="accent-blue-500"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-slate-600">
            <span>Толщина: <strong>{polyline.lineWidth}px</strong></span>
            <input
              type="range" min={1} max={8}
              value={polyline.lineWidth}
              onChange={(e) => onUpdate({ ...polyline, lineWidth: +e.target.value })}
              className="accent-blue-500"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span>Цвет</span>
            <input
              type="color"
              value={polyline.color}
              onChange={(e) => onUpdate({ ...polyline, color: e.target.value })}
              className="w-7 h-6 rounded cursor-pointer border border-slate-200"
            />
          </label>
        </div>
      )}
    </div>
  );
}
