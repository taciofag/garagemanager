import { useEffect, useState } from 'react';

const resolveColor = (className: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;

  const el = document.createElement('span');
  el.className = `${className} hidden`;
  document.body.appendChild(el);
  const computed = window.getComputedStyle(el).color;
  document.body.removeChild(el);

  return computed || fallback;
};

const useTailwindColor = (className: string, fallback: string) => {
  const [color, setColor] = useState(fallback);

  useEffect(() => {
    setColor(resolveColor(className, fallback));
  }, [className, fallback]);

  return color;
};

export const useTailwindColorPalette = () => {
  const color1 = useTailwindColor('text-primary', 'rgba(37, 99, 235, 1)');
  const color2 = useTailwindColor('text-accent', 'rgba(34, 197, 94, 1)');
  const color3 = useTailwindColor('text-sky-500', 'rgba(14, 165, 233, 1)');
  const color4 = useTailwindColor('text-indigo-400', 'rgba(129, 140, 248, 1)');
  const color5 = useTailwindColor('text-amber-500', 'rgba(245, 158, 11, 1)');
  const color6 = useTailwindColor('text-rose-400', 'rgba(251, 113, 133, 1)');

  return [color1, color2, color3, color4, color5, color6] as const;
};

export const useTailwindColorSingle = (className: string, fallback: string) =>
  useTailwindColor(className, fallback);
