"use client";

import { useEffect, useState } from "react";

interface Props {
  amount: number;
  x?: number;
  y?: number;
}

export function XPPopup({ amount, x = 50, y = 50 }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed pointer-events-none animate-pulse z-50"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="relative">
        {/* Animated upward text */}
        <div
          className="text-xl font-bold text-amber-400 drop-shadow-lg select-none"
          style={{
            animation: "float-up 1s ease-out forwards",
          }}
        >
          +{amount} XP
        </div>

        {/* Particle effect */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            animation: "particle-burst 1s ease-out forwards",
          }}
        >
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-amber-400 rounded-full"
              style={{
                left: "50%",
                top: "50%",
                animation: `particle-${i} 1s ease-out forwards`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes float-up {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-40px);
          }
        }

        @keyframes particle-burst {
          0% {
            transform: scale(1);
          }
          100% {
            transform: scale(0);
          }
        }

        @keyframes particle-0 {
          0% {
            transform: translate(0, 0);
            opacity: 1;
          }
          100% {
            transform: translate(30px, -40px);
            opacity: 0;
          }
        }

        @keyframes particle-1 {
          0% {
            transform: translate(0, 0);
            opacity: 1;
          }
          100% {
            transform: translate(-30px, -40px);
            opacity: 0;
          }
        }

        @keyframes particle-2 {
          0% {
            transform: translate(0, 0);
            opacity: 1;
          }
          100% {
            transform: translate(0, -50px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
