import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth-context";

let hasShown = false;

export function Splash({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const [done, setDone] = useState(hasShown);
  const [fading, setFading] = useState(false);
  const [minElapsed, setMinElapsed] = useState(hasShown);

  useEffect(() => {
    if (hasShown) return;
    const t = setTimeout(() => setMinElapsed(true), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (done || hasShown) return;
    if (minElapsed && !loading) {
      setFading(true);
      const t = setTimeout(() => {
        hasShown = true;
        setDone(true);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [minElapsed, loading, done]);

  return (
    <>
      {children}
      {!done && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#185FA5",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: fading ? 0 : 1,
            transition: "opacity 300ms ease-out",
            pointerEvents: fading ? "none" : "auto",
          }}
        >
          <h1
            style={{
              color: "white",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              fontSize: "2.5rem",
              fontWeight: 300,
              letterSpacing: "0.05em",
              margin: 0,
              marginBottom: "1.5rem",
            }}
          >
            Swim Log
          </h1>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[0.6, 0.8, 1.0].map((opacity, i) => (
              <svg
                key={i}
                width="200"
                height="20"
                viewBox="0 0 200 20"
                fill="none"
                style={{
                  opacity,
                  animation: `splash-wave 2.4s ease-in-out ${i * 0.2}s infinite`,
                }}
              >
                <path
                  d="M0 10 Q 25 0, 50 10 T 100 10 T 150 10 T 200 10"
                  stroke="white"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            ))}
          </div>
          <style>{`
            @keyframes splash-wave {
              0%, 100% { transform: translateX(-8px); }
              50% { transform: translateX(8px); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
