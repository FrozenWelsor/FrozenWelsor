// Геометрия адаптирована из Expressive Profile, Copyright (c) 2026 metawka, MIT.
// Источник и лицензия: resources/expressive-profile/.
const SHAPES = { cookie: [9, .07, 1], cookie12: [12, .05, 1], clover: [4, .2, 1], sunny: [8, .1, 2.2], flower: [8, .16, 1], soft: [4, .05, .6] };

export function shape(kind, cx, cy, radius) {
  const [lobes, amplitude, sharpness] = SHAPES[kind] ?? SHAPES.cookie;
  const points = Array.from({ length: 180 }, (_, index) => {
    const angle = 2 * Math.PI * index / 180;
    const cosine = Math.cos(lobes * angle);
    const radial = 1 - amplitude + amplitude * Math.sign(cosine) * Math.abs(cosine) ** (1 / sharpness);
    const theta = angle - Math.PI / 2;
    return `${(cx + radius * radial * Math.cos(theta)).toFixed(1)} ${(cy + radius * radial * Math.sin(theta)).toFixed(1)}`;
  });
  return `M${points.join(' L')} Z`;
}
