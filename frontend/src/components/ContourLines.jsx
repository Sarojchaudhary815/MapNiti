import React from "react";

// Decorative flowing contour-line pattern, built as real vector paths (not a
// raster image) so it stays crisp at any size and can be recolored via
// currentColor. Lines braid together using two offset sine components so
// they converge and cross like a topographic/interference pattern.
const LINE_COUNT = 16;
const SAMPLES = 40;

function buildPath(index, width, height) {
  const spacing = height / (LINE_COUNT - 1);
  const baseY = index * spacing;
  const phase = (index / LINE_COUNT) * Math.PI * 2;

  let d = "";
  for (let s = 0; s <= SAMPLES; s++) {
    const x = (s / SAMPLES) * width;
    const t = s / SAMPLES;
    const y =
      baseY +
      Math.sin(t * Math.PI * 1.6 + phase) * height * 0.12 +
      Math.sin(t * Math.PI * 3.1 + phase * 1.4) * height * 0.04;
    d += s === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

const ContourLines = ({ className = "" }) => {
  const width = 800;
  const height = 900;
  const paths = Array.from({ length: LINE_COUNT }, (_, i) => buildPath(i, width, height));

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} stroke="currentColor" strokeWidth="1" opacity={0.22} />
      ))}
    </svg>
  );
};

export default ContourLines;
