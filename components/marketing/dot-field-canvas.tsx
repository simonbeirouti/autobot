"use client";

import { useRef } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

type DotFieldVariant = "centered-circles" | "bottom-semicircle";

type DotFieldCanvasProps = {
  variant: DotFieldVariant;
  className?: string;
  dotColor?: string;
  backgroundColor?: string;
};

type DotPoint = {
  x: number;
  y: number;
  strength: number;
};

export function DotFieldCanvas({
  variant,
  className,
  dotColor,
  backgroundColor,
}: DotFieldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const effectiveDotColor =
    dotColor ?? (resolvedTheme === "dark" ? "rgba(255,255,255,0.24)" : "rgba(17,17,17,0.28)");
  const effectiveBackgroundColor = backgroundColor ?? "transparent";

  useGSAP(
    () => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const context = canvas.getContext("2d");

      if (!context) {
        return;
      }

      const easedPointer = { x: -9999, y: -9999 };
      const moveX = gsap.quickTo(easedPointer, "x", { duration: 0.35, ease: "power3.out" });
      const moveY = gsap.quickTo(easedPointer, "y", { duration: 0.35, ease: "power3.out" });
      let dots: DotPoint[] = [];
      let width = 0;
      let height = 0;
      let pixelRatio = 1;

      const createCenteredCircles = (nextWidth: number, nextHeight: number) => {
        const centerX = nextWidth * 0.5;
        const centerY = nextHeight * 0.5;
        const maxRadius = Math.hypot(nextWidth * 0.62, nextHeight * 0.62);
        const ringStep = Math.max(16, maxRadius / 24);
        const nextDots: DotPoint[] = [];

        for (let radius = ringStep; radius <= maxRadius; radius += ringStep) {
          const circumference = Math.PI * 2 * radius;
          const pointCount = Math.max(28, Math.floor(circumference / 20));

          for (let index = 0; index < pointCount; index += 1) {
            const angle = (index / pointCount) * Math.PI * 2;
            nextDots.push({
              x: centerX + Math.cos(angle) * radius,
              y: centerY + Math.sin(angle) * radius,
              strength: 0.5 + radius / maxRadius,
            });
          }
        }

        return nextDots;
      };

      const createBottomSemicircle = (nextWidth: number, nextHeight: number) => {
        const centerX = nextWidth * 0.5;
        const centerY = nextHeight * 1.04;
        const maxRadius = Math.max(nextWidth * 0.72, nextHeight * 0.9);
        const ringStep = Math.max(22, maxRadius / 18);
        const nextDots: DotPoint[] = [];

        for (let radius = ringStep; radius <= maxRadius; radius += ringStep) {
          const arcLength = Math.PI * radius;
          const pointCount = Math.max(36, Math.floor(arcLength / 18));

          for (let index = 0; index <= pointCount; index += 1) {
            const angle = Math.PI + (index / pointCount) * Math.PI;
            nextDots.push({
              x: centerX + Math.cos(angle) * radius,
              y: centerY + Math.sin(angle) * radius,
              strength: 0.45 + radius / maxRadius,
            });
          }
        }

        return nextDots;
      };

      const createDots = (nextWidth: number, nextHeight: number) =>
        variant === "centered-circles"
          ? createCenteredCircles(nextWidth, nextHeight)
          : createBottomSemicircle(nextWidth, nextHeight);

      const resize = () => {
        const bounds = canvas.getBoundingClientRect();
        width = Math.max(bounds.width, 1);
        height = Math.max(bounds.height, 1);
        pixelRatio = window.devicePixelRatio || 1;

        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        dots = createDots(width, height);
      };

      const draw = () => {
        context.clearRect(0, 0, width, height);

        if (effectiveBackgroundColor !== "transparent") {
          context.fillStyle = effectiveBackgroundColor;
          context.fillRect(0, 0, width, height);
        }

        const time = performance.now() * 0.001;

        for (const dot of dots) {
          const dx = dot.x - easedPointer.x;
          const dy = dot.y - easedPointer.y;
          const distance = Math.hypot(dx, dy);
          const influence = Math.max(0, 1 - distance / 180);
          const angle = Math.atan2(dy, dx);
          const repelDistance = influence * 18 * dot.strength;
          const driftX = Math.sin(time * 0.9 + dot.y * 0.014) * 1.6;
          const driftY = Math.cos(time * 0.85 + dot.x * 0.012) * 1.6;
          const drawX = dot.x + Math.cos(angle) * repelDistance + driftX;
          const drawY = dot.y + Math.sin(angle) * repelDistance + driftY;
          const radius = influence > 0 ? 1.8 : 1.25;

          context.beginPath();
          context.arc(drawX, drawY, radius, 0, Math.PI * 2);
          context.fillStyle = effectiveDotColor;
          context.fill();
        }
      };

      const handlePointerMove = (event: PointerEvent) => {
        const bounds = canvas.getBoundingClientRect();
        const nextX = event.clientX - bounds.left;
        const nextY = event.clientY - bounds.top;
        const isInside =
          nextX >= 0 &&
          nextX <= bounds.width &&
          nextY >= 0 &&
          nextY <= bounds.height;

        if (!isInside) {
          moveX(-9999);
          moveY(-9999);
          return;
        }

        moveX(nextX);
        moveY(nextY);
      };

      const handlePointerLeave = () => {
        moveX(-9999);
        moveY(-9999);
      };

      resize();
      draw();

      const ticker = () => draw();

      gsap.ticker.add(ticker);
      window.addEventListener("resize", resize);
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerleave", handlePointerLeave);

      return () => {
        gsap.ticker.remove(ticker);
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerleave", handlePointerLeave);
      };
    },
    { scope: canvasRef, dependencies: [variant, effectiveDotColor, effectiveBackgroundColor] },
  );

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    />
  );
}
