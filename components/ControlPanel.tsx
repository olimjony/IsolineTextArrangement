'use client';

import { Polyline, Tool } from '@/lib/types';
import { PlacementStats, PlacementAlgorithm } from '@/lib/labelPlacement';
import { ColorMode } from '@/lib/renderScene';
import { ParseDiagnostics } from '@/lib/parseLinesFile';

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
  globalStep: number;
  globalFontSize: number;
  globalLineWidth: number | null; // null = индивидуально
  colorMode: ColorMode;
  singleColor: string;
  showGrid: boolean;
  algorithm: PlacementAlgorithm;
  scalePercent: number; // viewport.scale * 100, для отображения
  isPlacing: boolean;
  labelsPlaced: boolean;
  stats: PlacementStats | null;
  onToolChange: (t: Tool) => void;
  onColorChange: (c: string) => void;
  onStepChange: (s: number) => void;
  onLineWidthChange: (w: number) => void;
  onGlobalStepChange: (s: number) => void;
  onGlobalFontSizeChange: (s: number) => void;
  onGlobalLineWidthChange: (w: number | null) => void;
  onColorModeChange: (m: ColorMode) => void;
  onSingleColorChange: (c: string) => void;
  onAlgorithmChange: (a: PlacementAlgorithm) => void;
  onShowGridChange: (v: boolean) => void;
  onBenchmark: () => void;
  isBenchmarking: boolean;
  benchmarkResults: { sat: PlacementStats; bitmap: PlacementStats } | null;
  autoPlace: boolean;
  onAutoPlaceChange: (v: boolean) => void;
  onPlaceLabels: () => void;
  onClearLabels: () => void;
  onClearAll: () => void;
  onLoadSample: () => void;
  onLoadFile: (file: File) => void;
  onExportPdf: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onResetView: () => void;
  onPolylineUpdate: (p: Polyline) => void;
  onPolylineDelete: (id: string) => void;
  onPolylineSelect: (id: string | null) => void;
  onFullBenchmark: () => void;
  isFullBenchmarking: boolean;
  parseDiagnostics: ParseDiagnostics | null;
  lastLoadedFileName: string | null;
}

export default function ControlPanel({
  polylines,
  tool,
  selectedId,
  currentColor,
  currentStep,
  currentLineWidth,
  globalStep,
  globalFontSize,
  globalLineWidth,
  colorMode,
  singleColor,
  showGrid,
  algorithm,
  scalePercent,
  isPlacing,
  labelsPlaced,
  stats,
  onToolChange,
  onColorChange,
  onStepChange,
  onLineWidthChange,
  onGlobalStepChange,
  onGlobalFontSizeChange,
  onGlobalLineWidthChange,
  onColorModeChange,
  onSingleColorChange,
  onAlgorithmChange,
  onShowGridChange,
  onBenchmark,
  isBenchmarking,
  benchmarkResults,
  autoPlace,
  onAutoPlaceChange,
  onPlaceLabels,
  onClearLabels,
  onClearAll,
  onLoadSample,
  onLoadFile,
  onExportPdf,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onResetView,
  onPolylineUpdate,
  onPolylineDelete,
  onPolylineSelect,
  onFullBenchmark,
  isFullBenchmarking,
  parseDiagnostics,
  lastLoadedFileName,
}: ControlPanelProps) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onLoadFile(f);
    e.target.value = ''; // reset, чтобы повторно выбирать тот же файл
  };
  return (
    <aside className="w-72 min-w-[17rem] bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      {/* Заголовок */}
      <div className="bg-slate-800 text-white px-4 py-3">
        <h1 className="font-semibold text-sm">Подписи на изолиниях</h1>
        <p className="text-slate-400 text-xs mt-0.5">Векторная карта</p>
      </div>

      <div className="overflow-y-auto flex-1 p-3 space-y-4">
        {/* Загрузка карты */}
        <Section title="Карта">
          <label className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium
                            py-2 rounded-lg cursor-pointer text-center transition-colors">
            <input
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={handleFile}
            />
            Загрузить файл (.txt)
          </label>
          <div className="text-[11px] text-slate-400 mt-1 mb-2">
            Формат: «значение X Y», ломаные через «-----»
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(['lines20', 'lines10', 'lines5'] as const).map((name) => (
              <button
                key={name}
                onClick={async () => {
                  const r = await fetch(`/samples/${name}.txt`);
                  const blob = await r.blob();
                  onLoadFile(new File([blob], `${name}.txt`));
                }}
                className="text-xs py-1.5 rounded border border-slate-200 hover:border-blue-400
                           hover:bg-blue-50 text-slate-600 transition-colors"
                title={`Реальная карта (${name})`}
              >
                {name}
              </button>
            ))}
          </div>

          {parseDiagnostics && (
            <ParseDiagnosticsBlock
              diagnostics={parseDiagnostics}
              fileName={lastLoadedFileName}
            />
          )}
        </Section>

        {/* Масштаб карты */}
        <Section title={`Масштаб: ${scalePercent.toFixed(0)}%`}>
          <div className="grid grid-cols-4 gap-1">
            <ZoomBtn onClick={onZoomOut} title="Уменьшить">−</ZoomBtn>
            <ZoomBtn onClick={onZoomIn} title="Увеличить">+</ZoomBtn>
            <ZoomBtn onClick={onFitToScreen} title="Вписать в экран">⤢</ZoomBtn>
            <ZoomBtn onClick={onResetView} title="Сбросить">↺</ZoomBtn>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Колесо мыши — зум · ПКМ/средняя — панорама
          </div>
        </Section>

        {/* Алгоритм размещения */}
        <Section title="Алгоритм">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onAlgorithmChange('bitmap')}
              className={`py-1.5 text-xs rounded border transition-all
                ${algorithm === 'bitmap'
                  ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
              title="Растровый: O(M+N+K) через битовую маску и Брезенхэма"
            >
              🚀 Растровый
            </button>
            <button
              onClick={() => onAlgorithmChange('sat')}
              className={`py-1.5 text-xs rounded border transition-all
                ${algorithm === 'sat'
                  ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
              title="Точный: SAT/OBB геометрия с равномерной сеткой"
            >
              📐 Точный
            </button>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {algorithm === 'bitmap'
              ? 'O(M + N + K) — битовая маска, Брезенхэм'
              : 'O(N · M) — точная геометрия (SAT)'}
          </div>
          <button
            onClick={onBenchmark}
            disabled={polylines.length === 0 || isBenchmarking}
            className="mt-2 w-full border border-purple-300 hover:bg-purple-50 disabled:opacity-40
                       disabled:cursor-not-allowed text-purple-700 text-xs font-medium py-1.5
                       rounded transition-colors flex items-center justify-center gap-1.5"
          >
            {isBenchmarking
              ? <><span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> Замеряем...</>
              : '⏱ Сравнить алгоритмы'}
          </button>
          {benchmarkResults && (
            <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-2 text-[11px] space-y-1">
              <div className="flex justify-between font-semibold text-slate-600 pb-1 border-b border-slate-200">
                <span>Алгоритм</span><span>Время</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">🚀 Растровый</span>
                <span className={`font-semibold tabular-nums ${benchmarkResults.bitmap.durationMs < benchmarkResults.sat.durationMs ? 'text-green-700' : 'text-slate-700'}`}>
                  {benchmarkResults.bitmap.durationMs} мс
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">📐 Точный</span>
                <span className={`font-semibold tabular-nums ${benchmarkResults.sat.durationMs < benchmarkResults.bitmap.durationMs ? 'text-green-700' : 'text-slate-700'}`}>
                  {benchmarkResults.sat.durationMs} мс
                </span>
              </div>
              {benchmarkResults.sat.durationMs > 0 && (
                <div className="pt-1 border-t border-slate-200 text-slate-500">
                  Растровый быстрее в{' '}
                  <strong className="text-green-700">
                    {(benchmarkResults.sat.durationMs / Math.max(1, benchmarkResults.bitmap.durationMs)).toFixed(1)}×
                  </strong>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Шаг подписей (глобально) */}
        <Section title={`Шаг подписей: ${globalStep.toFixed(1)} × длины`}>
          <input
            type="range" min={1} max={6} step={0.5}
            value={globalStep}
            onChange={(e) => onGlobalStepChange(+e.target.value)}
            className="w-full accent-blue-500"
          />
          <div className="text-[11px] text-slate-400 mt-1">
            Расстояние между подписями в долях длины подписи
          </div>
        </Section>

        {/* Глобальные настройки оформления */}
        <Section title="Стиль (глобально)">
          {/* Размер шрифта */}
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Размер шрифта: <span className="font-medium text-slate-800">{globalFontSize}px</span>
            <input
              type="range" min={9} max={28}
              value={globalFontSize}
              onChange={(e) => onGlobalFontSizeChange(+e.target.value)}
              className="accent-blue-500"
            />
          </label>

          {/* Толщина линий */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
              <span>
                Толщина линий: <strong className="text-slate-800">
                  {globalLineWidth === null ? 'индивидуально' : `${globalLineWidth}px`}
                </strong>
              </span>
              <button
                onClick={() => onGlobalLineWidthChange(globalLineWidth === null ? 2 : null)}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors
                  ${globalLineWidth === null
                    ? 'border-slate-200 text-slate-500 hover:border-slate-300'
                    : 'border-blue-400 text-blue-600 bg-blue-50'}`}
              >
                {globalLineWidth === null ? 'Сделать общей' : 'По линиям'}
              </button>
            </div>
            {globalLineWidth !== null && (
              <input
                type="range" min={0.5} max={8} step={0.5}
                value={globalLineWidth}
                onChange={(e) => onGlobalLineWidthChange(+e.target.value)}
                className="w-full accent-blue-500"
              />
            )}
          </div>

          {/* Цвет */}
          <div className="mt-3">
            <div className="text-xs text-slate-600 mb-1">Цвет линий и подписей</div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => onColorModeChange('rainbow')}
                className={`py-1.5 text-xs rounded border transition-all
                  ${colorMode === 'rainbow'
                    ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
              >
                🌈 Радужный
              </button>
              <button
                onClick={() => onColorModeChange('single')}
                className={`py-1.5 text-xs rounded border transition-all
                  ${colorMode === 'single'
                    ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
              >
                ● Один цвет
              </button>
            </div>
            {colorMode === 'single' && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={singleColor}
                  onChange={(e) => onSingleColorChange(e.target.value)}
                  className="w-9 h-7 rounded cursor-pointer border border-slate-200"
                />
                <div className="flex flex-wrap gap-1">
                  {['#1e40af', '#7c2d12', '#166534', '#581c87', '#0f172a', '#dc2626'].map((c) => (
                    <button
                      key={c}
                      onClick={() => onSingleColorChange(c)}
                      className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110
                        ${singleColor === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

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

        {/* Сетка */}
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => onShowGridChange(e.target.checked)}
            className="accent-blue-500"
          />
          Показывать сетку
        </label>

        {/* Статистика размещения */}
        {stats && (
          <Section title="Статистика размещения">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1 text-xs">
              <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                <span className="text-slate-500">Алгоритм</span>
                <span className="font-semibold text-slate-800">
                  {stats.algorithm === 'bitmap' ? '🚀 Растровый' : '📐 Точный'}
                </span>
              </div>
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
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="text-slate-500">Время</span>
                <span className={`font-semibold tabular-nums ${stats.durationMs < 1000 ? 'text-green-700' : 'text-orange-700'}`}>
                  {stats.durationMs} мс
                </span>
              </div>
              {stats.memoryKb !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Память маски</span>
                  <span className="font-semibold tabular-nums text-slate-700">{stats.memoryKb} КБ</span>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Кнопки действий */}
        <Section title="Действия">
          <div className="space-y-1.5">
            <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all
              ${autoPlace
                ? 'bg-green-50 border-green-400 text-green-800'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              <input
                type="checkbox"
                checked={autoPlace}
                onChange={(e) => onAutoPlaceChange(e.target.checked)}
                className="accent-green-600 w-4 h-4"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium leading-tight">
                  {autoPlace ? '🔄 Авто-расстановка вкл.' : 'Авто-расстановка'}
                </div>
                <div className="text-[10px] opacity-70 mt-0.5 leading-tight">
                  Подписи обновляются при зуме и панораме
                </div>
              </div>
            </label>
            <button
              onClick={onPlaceLabels}
              disabled={polylines.length === 0 || isPlacing}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                         text-white text-sm font-medium py-2 rounded-lg transition-colors
                         flex items-center justify-center gap-2"
            >
              {isPlacing && (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {isPlacing ? 'Размещаем...' : 'Расставить подписи'}
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

        {/* Полный бенчмарк — в самом низу */}
        <Section title="Полный бенчмарк">
          <button
            onClick={onFullBenchmark}
            disabled={polylines.length === 0 || isFullBenchmarking}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed
                       text-white text-sm font-medium py-2 rounded-lg transition-colors
                       flex items-center justify-center gap-2"
          >
            {isFullBenchmarking
              ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Прогоняем...</>
              : '📊 Прогнать все масштабы (20–100%)'}
          </button>
          <div className="text-[11px] text-slate-400 mt-1.5 leading-snug">
            Виртуально считает оба алгоритма для масштабов 20%, 40%, 60%, 80%, 100%
            (fit-to-screen). Экран не меняется. Результаты — в таблице.
          </div>
        </Section>
      </div>

      {/* Статус */}
      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400 bg-slate-50">
        {polylines.length} линий · {algorithm === 'bitmap' ? '🚀 Растровый O(M+N+K)' : '📐 Точный O(N·M)'}
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

function ZoomBtn({
  onClick, title, children,
}: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="py-1.5 text-base rounded border border-slate-200 hover:border-blue-400 hover:bg-blue-50
                 text-slate-700 transition-colors"
    >
      {children}
    </button>
  );
}

function ParseDiagnosticsBlock({
  diagnostics: d,
  fileName,
}: {
  diagnostics: ParseDiagnostics;
  fileName: string | null;
}) {
  const hasIssues = d.sectionsDropped > 0 || d.malformedLines > 0;
  const okStyle = 'bg-green-50 border-green-200';
  const warnStyle = 'bg-orange-50 border-orange-200';

  return (
    <div className={`mt-2 rounded-lg p-2 text-[11px] border ${hasIssues ? warnStyle : okStyle}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`font-semibold ${hasIssues ? 'text-orange-800' : 'text-green-800'}`}>
          {hasIssues ? '⚠ Загружено с замечаниями' : '✓ Загружено чисто'}
        </span>
        <span className="text-slate-500 truncate max-w-[8rem]" title={fileName ?? ''}>
          {fileName}
        </span>
      </div>

      <div className="space-y-0.5 text-slate-700">
        <DiagRow label="Секций в файле" value={d.totalSections} />
        <DiagRow label="Создано ломаных" value={d.polylinesCreated} bold color="text-green-800" />
        <DiagRow label="Точек в ломаных" value={d.pointsInPolylines} />
        {d.sectionsDropped > 0 && (
          <DiagRow
            label="⚠ Пропущено секций"
            value={d.sectionsDropped}
            bold
            color="text-orange-800"
          />
        )}
        {d.sentinelsSkipped > 0 && (
          <DiagRow
            label="Sentinel-точек (< −900)"
            value={d.sentinelsSkipped}
            color="text-slate-500"
          />
        )}
        {d.malformedLines > 0 && (
          <DiagRow
            label="⚠ Битых строк"
            value={d.malformedLines}
            bold
            color="text-red-700"
          />
        )}
      </div>

      {d.droppedSections.length > 0 && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-[10px] text-orange-700 hover:underline">
            Какие секции потерялись ({d.droppedSections.length})
          </summary>
          <div className="mt-1 max-h-28 overflow-y-auto bg-white border border-slate-200 rounded p-1.5 space-y-0.5">
            {d.droppedSections.slice(0, 100).map((s, i) => (
              <div key={i} className="text-[10px] text-slate-600 tabular-nums flex justify-between">
                <span>value = {s.value}</span>
                <span className="text-slate-400">
                  {s.pointCount} {s.pointCount === 1 ? 'точка' : 'точек'}
                  {s.firstPoint && ` @ (${Math.round(s.firstPoint.x)}, ${Math.round(s.firstPoint.y)})`}
                </span>
              </div>
            ))}
            {d.droppedSections.length > 100 && (
              <div className="text-[10px] text-slate-400 italic">
                …и ещё {d.droppedSections.length - 100}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function DiagRow({
  label, value, bold, color,
}: {
  label: string;
  value: number;
  bold?: boolean;
  color?: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-600">{label}</span>
      <span className={`tabular-nums ${bold ? 'font-semibold' : ''} ${color ?? 'text-slate-800'}`}>
        {value}
      </span>
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
