/** A tiny self-contained confetti burst on a throwaway full-screen canvas. */

const COLORS = ["#34d399", "#fbbf24", "#f472b6", "#60a5fa", "#ffffff"];

export function confettiBurst(origin: { x: number; y: number } = { x: 0.5, y: 0.45 }, particleCount = 140): void {
  if (typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:70;";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return void canvas.remove();

  const ox = origin.x * canvas.width;
  const oy = origin.y * canvas.height;
  const parts = Array.from({ length: particleCount }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.85);
    const speed = 6 + Math.random() * 8;
    return {
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      spin: Math.random() * Math.PI,
      spinV: (Math.random() - 0.5) * 0.3,
      life: 1,
    };
  });

  const started = performance.now();
  const duration = 1300;
  function frame(t: number) {
    if (!ctx) return;
    const elapsed = t - started;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22;
      p.vx *= 0.985;
      p.spin += p.spinV;
      p.life = Math.max(0, 1 - elapsed / duration);
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (elapsed < duration) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
