"use client";

import { useEffect, useState } from "react";
import { Award, Sparkles } from "lucide-react";

interface Props {
  badgeName: string;
  onDismiss: () => void;
}

export function BadgeAnimation({ badgeName, onDismiss }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
      {/* Background fade */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        style={{ animation: "fade-in-out 3s ease-in-out forwards" }}
      />

      {/* Badge animation */}
      <div
        className="relative"
        style={{ animation: "scale-bounce 3s ease-out forwards" }}
      >
        {/* Glow ring */}
        <div
          className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 blur-xl opacity-75"
          style={{
            animation: "pulse-ring 3s ease-out forwards",
            width: "160px",
            height: "160px",
            marginLeft: "-80px",
            marginTop: "-80px",
          }}
        />

        {/* Badge circle */}
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center border-4 border-amber-200 shadow-2xl">
          <Award size={40} className="text-amber-900" />
        </div>

        {/* Sparkle particles */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-amber-300 rounded-full"
            style={{
              animation: `particle-scatter-${i} 3s ease-out forwards`,
              left: "50%",
              top: "50%",
            }}
          />
        ))}
      </div>

      {/* Badge name text */}
      <div
        className="absolute bottom-24 text-center"
        style={{ animation: "fade-in 1.5s ease-out forwards" }}
      >
        <div className="text-lg font-bold text-amber-400 drop-shadow-lg">
          {badgeName} Unlocked!
        </div>
        <div className="flex items-center justify-center gap-1 text-sm text-amber-300 mt-1">
          <Sparkles size={14} />
          Achievement Earned
        </div>
      </div>

      <style>{`
        @keyframes fade-in-out {
          0% {
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes fade-in {
          0% {
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes scale-bounce {
          0% {
            transform: scale(0) translateY(20px);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          70% {
            transform: scale(0.95);
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }

        @keyframes pulse-ring {
          0% {
            transform: scale(0.5);
            opacity: 1;
          }
          100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }

        ${[...Array(8)]
          .map(
            (_, i) => `
          @keyframes particle-scatter-${i} {
            0% {
              transform: translate(0, 0);
              opacity: 1;
            }
            100% {
              transform: translate(
                ${Math.cos((i / 8) * Math.PI * 2) * 80}px,
                ${Math.sin((i / 8) * Math.PI * 2) * 80}px
              );
              opacity: 0;
            }
          }
        `,
          )
          .join("")}
      `}</style>
    </div>
  );
}
