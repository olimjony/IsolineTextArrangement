export interface Point {
  x: number;
  y: number;
}

export interface Polyline {
  id: string;
  points: Point[];
  label: string;
  color: string;
  step: number; // шаг вывода (1 шаг = одна длина надписи)
  direction: 'forward' | 'reverse';
  lineWidth: number;
}

export interface PlacedLabel {
  polylineId: string;
  text: string;
  center: Point;
  angle: number; // радианы
  width: number;
  height: number;
  corners: Point[]; // 4 угла повёрнутого прямоугольника
}

export type Tool = 'draw' | 'select' | 'delete';
