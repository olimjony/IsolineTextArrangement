'use client';

import { useState, useMemo } from 'react';

export type PaperFormat = 'A4' | 'A3' | 'A5' | 'Letter' | 'Custom';
export type Orientation = 'portrait' | 'landscape';
export type Dpi = 72 | 150 | 300 | 600;

export interface ExportSettings {
  format: PaperFormat;
  orientation: Orientation;
  dpi: Dpi;
  customWidthMM: number;
  customHeightMM: number;
  showGrid: boolean;
  fileName: string;
}

// Размеры в миллиметрах (короткая × длинная сторона)
const PAPER_SIZES_MM: Record<Exclude<PaperFormat, 'Custom'>, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  A5: [148, 210],
  Letter: [216, 279],
};

export function getPaperSizeMM(s: ExportSettings): [number, number] {
  if (s.format === 'Custom') {
    return s.orientation === 'landscape'
      ? [Math.max(s.customWidthMM, s.customHeightMM), Math.min(s.customWidthMM, s.customHeightMM)]
      : [Math.min(s.customWidthMM, s.customHeightMM), Math.max(s.customWidthMM, s.customHeightMM)];
  }
  const [shortSide, longSide] = PAPER_SIZES_MM[s.format];
  return s.orientation === 'landscape' ? [longSide, shortSide] : [shortSide, longSide];
}

export function getPixelSize(s: ExportSettings): [number, number] {
  const [wMM, hMM] = getPaperSizeMM(s);
  const w = Math.round((wMM * s.dpi) / 25.4);
  const h = Math.round((hMM * s.dpi) / 25.4);
  return [w, h];
}

export const DEFAULT_SETTINGS: ExportSettings = {
  format: 'A4',
  orientation: 'landscape',
  dpi: 300,
  customWidthMM: 200,
  customHeightMM: 150,
  showGrid: false,
  fileName: 'isolines',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onExport: (settings: ExportSettings) => void;
}

export default function ExportDialog({ open, onClose, onExport }: Props) {
  const [settings, setSettings] = useState<ExportSettings>(DEFAULT_SETTINGS);

  const [pxW, pxH] = useMemo(() => getPixelSize(settings), [settings]);
  const [mmW, mmH] = useMemo(() => getPaperSizeMM(settings), [settings]);
  const estimatedSizeMB = ((pxW * pxH * 4) / (1024 * 1024)).toFixed(1);

  if (!open) return null;

  const update = <K extends keyof ExportSettings>(key: K, value: ExportSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="bg-slate-800 text-white px-5 py-3 flex items-center justify-between">
          <h2 className="font-semibold">Экспорт в PDF</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Имя файла */}
          <Field label="Имя файла">
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={settings.fileName}
                onChange={(e) => update('fileName', e.target.value)}
                className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
              />
              <span className="text-slate-400 text-sm">.pdf</span>
            </div>
          </Field>

          {/* Формат */}
          <Field label="Формат бумаги">
            <div className="grid grid-cols-5 gap-1.5">
              {(['A5', 'A4', 'A3', 'Letter', 'Custom'] as PaperFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => update('format', f)}
                  className={`py-1.5 text-xs rounded border transition-all
                    ${settings.format === f
                      ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </Field>

          {/* Размер при Custom */}
          {settings.format === 'Custom' && (
            <Field label="Размер (мм)">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={50}
                  max={1000}
                  value={settings.customWidthMM}
                  onChange={(e) => update('customWidthMM', +e.target.value)}
                  className="w-20 border border-slate-200 rounded px-2 py-1.5 text-sm"
                />
                <span className="text-slate-400 text-xs">×</span>
                <input
                  type="number"
                  min={50}
                  max={1000}
                  value={settings.customHeightMM}
                  onChange={(e) => update('customHeightMM', +e.target.value)}
                  className="w-20 border border-slate-200 rounded px-2 py-1.5 text-sm"
                />
                <span className="text-slate-400 text-xs">мм</span>
              </div>
            </Field>
          )}

          {/* Ориентация */}
          <Field label="Ориентация">
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { id: 'portrait', label: '▯ Портрет' },
                { id: 'landscape', label: '▭ Альбом' },
              ] as { id: Orientation; label: string }[]).map((o) => (
                <button
                  key={o.id}
                  onClick={() => update('orientation', o.id)}
                  className={`py-1.5 text-xs rounded border transition-all
                    ${settings.orientation === o.id
                      ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </Field>

          {/* DPI */}
          <Field label="Разрешение (DPI)">
            <div className="grid grid-cols-4 gap-1.5">
              {([72, 150, 300, 600] as Dpi[]).map((d) => (
                <button
                  key={d}
                  onClick={() => update('dpi', d)}
                  className={`py-1.5 text-xs rounded border transition-all
                    ${settings.dpi === d
                      ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              72 — экран · 150 — черновик · 300 — печать · 600 — высокое качество
            </div>
          </Field>

          {/* Сетка */}
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.showGrid}
              onChange={(e) => update('showGrid', e.target.checked)}
              className="accent-blue-500"
            />
            <span className="text-slate-700">Показывать сетку</span>
          </label>

          {/* Превью параметров */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-0.5">
            <div className="flex justify-between"><span>Бумага:</span> <strong className="text-slate-800">{mmW} × {mmH} мм</strong></div>
            <div className="flex justify-between"><span>Растр:</span> <strong className="text-slate-800">{pxW} × {pxH} px</strong></div>
            <div className="flex justify-between"><span>Оперативно:</span> <strong className="text-slate-800">≈ {estimatedSizeMB} МБ</strong></div>
            {pxW * pxH > 50_000_000 && (
              <div className="text-orange-600 mt-1">⚠ Очень большое разрешение — рендер может занять время</div>
            )}
          </div>
        </div>

        {/* Кнопки */}
        <div className="border-t border-slate-100 px-5 py-3 flex justify-end gap-2 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-white text-slate-600"
          >
            Отмена
          </button>
          <button
            onClick={() => onExport(settings)}
            className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            Экспортировать
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</div>
      {children}
    </div>
  );
}
