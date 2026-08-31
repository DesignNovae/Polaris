import { ImageResponse } from "next/og";

export const alt = "Polaris: Your Academic North Star";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "72px 82px",
          color: "#FAF6F0",
          background: "#2C1810",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 32, fontWeight: 700 }}>
            <span style={{ color: "#F4D7BC" }}>POLARIS</span>
            <span style={{ width: 70, height: 2, background: "#C47D4E" }} />
          </div>
          <div style={{ marginTop: 42, fontFamily: "serif", fontSize: 76, lineHeight: 1.04, letterSpacing: "-2px", fontWeight: 700 }}>
            Your academic north star.
          </div>
          <div style={{ marginTop: 30, maxWidth: 700, color: "#E7CCB4", fontSize: 28, lineHeight: 1.4 }}>
            Goals, evidence, deadlines, and daily action, directed in one clear strategy.
          </div>
        </div>

        <div style={{ position: "relative", width: 270, height: 270, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, border: "5px solid rgba(244,215,188,.55)", borderRadius: 999 }} />
          <div style={{ position: "absolute", inset: 34, border: "2px solid rgba(196,125,78,.65)", borderRadius: 999 }} />
          <div style={{ position: "absolute", width: 4, height: 238, background: "rgba(244,215,188,.18)" }} />
          <div style={{ position: "absolute", width: 238, height: 4, background: "rgba(244,215,188,.18)" }} />
          <div style={{ position: "absolute", top: 38, width: 50, height: 96, background: "#F4D7BC", clipPath: "polygon(50% 0, 100% 100%, 50% 83%, 0 100%)" }} />
          <div style={{ width: 34, height: 34, borderRadius: 999, background: "#F4D7BC", border: "10px solid #2C1810", zIndex: 2 }} />
        </div>
      </div>
    ),
    size,
  );
}
