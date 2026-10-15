import React, { useEffect, useState } from "react";

const PARTICLES = Array.from({ length: 24 }).map((_, i) => ({
  id: i,
  type: ["square", "circle", "triangle"][i % 3],
  color: ["var(--accent-red)", "var(--accent-blue)", "var(--accent-yellow)", "var(--text-black)"][i % 4],
  size: 8 + (i % 5) * 3,
  left: `${15 + (i * 3.2)}%`,
  delay: `${(i % 6) * 60}ms`,
  duration: `${1100 + (i % 4) * 200}ms`,
  rotation: `${(i * 45) % 360}deg`
}));

export default function GeometricConfetti() {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setActive(false);
    }, 2400);
    return () => clearTimeout(timer);
  }, []);

  if (!active) return null;

  return (
    <div className="geometric-confetti-stage" aria-hidden="true">
      {PARTICLES.map((p) => (
        <div
          key={p.id}
          className={`geo-confetti-particle geo-confetti-${p.type}`}
          style={{
            left: p.left,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.type !== "triangle" ? p.color : "transparent",
            borderBottomColor: p.type === "triangle" ? p.color : undefined,
            borderLeftWidth: p.type === "triangle" ? `${p.size / 2}px` : undefined,
            borderRightWidth: p.type === "triangle" ? `${p.size / 2}px` : undefined,
            borderBottomWidth: p.type === "triangle" ? `${p.size}px` : undefined,
            animationDelay: p.delay,
            animationDuration: p.duration,
            "--target-rotation": p.rotation
          }}
        />
      ))}
    </div>
  );
}
