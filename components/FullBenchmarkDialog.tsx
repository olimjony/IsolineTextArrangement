'use client';

import { useState } from 'react';
import {
  FullBenchmarkResult,
  toCsv,
  toMarkdown,
  downloadFile,
} from '@/lib/fullBenchmark';

interface Props {
  open: boolean;
  onClose: () => void;
  running: boolean;
  progress: { done: number; total: number; label: string };
  result: FullBenchmarkResult | null;
}

export default function FullBenchmarkDialog({
  open, onClose, running, progress, result,
}: Props) {
  const [copied, setCopied] = useState<'csv' | 'md' | null>(null);

  if (!open) return null;

  const handleDownloadCsv = () => {
    if (!result) return;
    downloadFile(
      toCsv(result),
      `benchmark-${Date.now()}.csv`,
      'text/csv;charset=utf-8'
    );
  };

  const handleCopyMd = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(toMarkdown(result));
    setCopied('md');
    setTimeout(() => setCopied(null), 1500);
  };

  const handleCopyCsv = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(toCsv(result));
    setCopied('csv');
    setTimeout(() => setCopied(null), 1500);
  };

  const m = result?.meta;
  const pct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={() => !running && onClose()}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="font-semibold text-slate-800">Полный бенчмарк</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Прогон по масштабам 20–100% × оба алгоритма (виртуально, экран не меняется)
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={running}
            className="text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed
                       w-8 h-8 rounded-full hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Тело */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Прогресс / мета */}
          {running && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium text-blue-900">
                  Считаем… {progress.label}
                </span>
                <span className="tabular-nums text-blue-700">
                  {progress.done} / {progress.total}
                </span>
              </div>
              <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {m && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs grid grid-cols-2 md:grid-cols-4 gap-2 text-slate-700">
              <Meta label="Дата" value={m.timestamp} />
              <Meta label="Ломаных" value={m.polylineCount} />
              <Meta label="Точек" value={m.pointCount} />
              <Meta label="Холст" value={`${m.canvasW}×${m.canvasH}`} />
              <Meta label="Fit scale" value={m.fitScale.toFixed(4)} />
              <Meta label="Шаг подписей" value={`${m.globalStep} × длины`} />
              <Meta label="Шрифт" value={`${m.globalFontSize}px`} />
              <Meta
                label="Толщина линии"
                value={m.globalLineWidth === null ? 'индивид.' : `${m.globalLineWidth}px`}
              />
            </div>
          )}

          {/* Таблица */}
          {result && (
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <Th>Масштаб</Th>
                    <Th>Алгоритм</Th>
                    <Th right>Попыток</Th>
                    <Th right>Размещено</Th>
                    <Th right>Успех %</Th>
                    <Th right>Откл. подп.</Th>
                    <Th right>Откл. лин.</Th>
                    <Th right>Время, мс</Th>
                    <Th right>Память, КБ</Th>
                    <Th right>Подп./мс</Th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r, i) => {
                    const isFirstOfPair = i % 2 === 0;
                    const algoName =
                      r.algorithmRequested === 'bitmap' ? '🚀 Растровый' : '📐 SAT';
                    return (
                      <tr
                        key={i}
                        className={`border-t border-slate-100 ${
                          isFirstOfPair ? 'bg-white' : 'bg-slate-50/40'
                        }`}
                      >
                        <Td>
                          {isFirstOfPair && (
                            <span className="font-semibold text-slate-700">
                              {r.scalePercent}%
                            </span>
                          )}
                        </Td>
                        <Td>
                          <span className="text-slate-700">{algoName}</span>
                          {r.fellBack && (
                            <span className="ml-1 text-[10px] text-orange-600">(fallback→SAT)</span>
                          )}
                        </Td>
                        <Td right tabular>{r.attempted}</Td>
                        <Td right tabular bold>{r.placed}</Td>
                        <Td right tabular>{r.successRate.toFixed(1)}</Td>
                        <Td right tabular>{r.rejectedByLabel}</Td>
                        <Td right tabular>{r.rejectedByPolyline}</Td>
                        <Td right tabular bold>{r.durationMs}</Td>
                        <Td right tabular>
                          {r.memoryKb !== undefined ? r.memoryKb : '—'}
                        </Td>
                        <Td right tabular>{r.labelsPerMs.toFixed(2)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!running && !result && (
            <div className="text-center text-slate-400 py-12 text-sm">
              Нет результатов. Запустите бенчмарк из боковой панели.
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            {result
              ? `Всего строк: ${result.rows.length}`
              : running
              ? 'Прогон в процессе…'
              : ''}
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleCopyMd}
              disabled={!result}
              className="px-3 py-1.5 text-xs border border-slate-300 hover:bg-white text-slate-700
                         rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {copied === 'md' ? '✓ Скопировано' : '📋 Markdown'}
            </button>
            <button
              onClick={handleCopyCsv}
              disabled={!result}
              className="px-3 py-1.5 text-xs border border-slate-300 hover:bg-white text-slate-700
                         rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {copied === 'csv' ? '✓ Скопировано' : '📋 CSV'}
            </button>
            <button
              onClick={handleDownloadCsv}
              disabled={!result}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white
                         rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ⬇ Скачать CSV
            </button>
            <button
              onClick={onClose}
              disabled={running}
              className="px-3 py-1.5 text-xs border border-slate-300 hover:bg-white text-slate-700
                         rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-slate-400">{label}</div>
      <div className="font-medium text-slate-800 tabular-nums">{value}</div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 font-semibold text-[11px] uppercase tracking-wider ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({
  children, right, tabular, bold,
}: {
  children: React.ReactNode;
  right?: boolean;
  tabular?: boolean;
  bold?: boolean;
}) {
  return (
    <td
      className={`px-3 py-1.5 ${right ? 'text-right' : 'text-left'} ${
        tabular ? 'tabular-nums' : ''
      } ${bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}
    >
      {children}
    </td>
  );
}
