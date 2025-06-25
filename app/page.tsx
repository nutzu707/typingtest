"use client";
import { useEffect, useRef } from "react";
import TypingSpeedCounter from "./components/typing";

function useAnimatedGradient(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!ref.current) return;

    let animationFrame: number;
    let t = 0;

    function animate() {
      // Animate hue for a smooth color shift
      const hue1 = (t * 40) % 360;
      const hue2 = (hue1 + 60) % 360;
      const hue3 = (hue1 + 120) % 360;

      // You can adjust the lightness and saturation for different effects
      const color1 = `hsl(${hue1}, 80%, 90%)`;
      const color2 = `hsl(${hue2}, 100%, 98%)`;
      const color3 = `hsl(${hue3}, 80%, 80%)`;

      if (ref.current) {
        ref.current.style.background = `linear-gradient(135deg, ${color1}, ${color2}, ${color3})`;
      }

      t += 0.003;
      animationFrame = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [ref]);
}

export default function Home() {
  const bgRef = useRef<HTMLDivElement>(null);
  useAnimatedGradient(bgRef);

  return (
    <div
      ref={bgRef}
      className="w-full min-h-screen flex pt-32 justify-center transition-colors duration-1000"
    >
      <TypingSpeedCounter />
    </div>
  );
}
