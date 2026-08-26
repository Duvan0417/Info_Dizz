import { useEffect, useState } from 'react';

/** Barra de progreso tipo "carga de batería": arranca en 0% y anima con
 * CSS (transition de `width`) hasta `value` apenas monta, con extremos
 * redondeados. Se usa en el ranking de vendedores y en el resumen de cada
 * concurso (ver ConcursosOverview/ConcursoCard) para el % de cumplimiento.
 *
 * El doble requestAnimationFrame es necesario para que el navegador
 * realmente pinte el 0% inicial antes de aplicar el valor real: sin eso, a
 * veces React/el navegador funden ambos renders en un solo frame y la
 * transicion nunca se ve (salta directo al valor final). */
export default function ProgressBar({ value, color, trackClassName = 'h-1.5 w-16', barClassName = '' }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const target = Math.min(100, Math.max(0, value ?? 0));
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setWidth(target));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [value]);

  return (
    <span className={`block shrink-0 overflow-hidden rounded-full bg-surface-muted ${trackClassName}`}>
      <span
        className={`block h-full rounded-full transition-[width] duration-700 ease-out ${barClassName}`}
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </span>
  );
}
