import { ImageResponse } from "next/og";

export const alt = "AutoBot";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, rgb(255, 248, 224) 0%, rgb(255, 232, 177) 45%, rgb(255, 207, 112) 100%)",
          color: "rgb(49, 32, 9)",
          padding: "64px",
          fontFamily: "Avenir Next, Helvetica Neue, Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: "-0.04em",
          }}
        >
          <span>AutoBot</span>
          <span style={{ fontSize: 24, opacity: 0.72 }}>Build apps faster</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "880px" }}>
          <div style={{ fontSize: 78, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.06em" }}>
            Turn product ideas into working software.
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.3, opacity: 0.82 }}>
            Plan, scaffold, and ship with a guided AI workflow built for real product teams.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 24, opacity: 0.72 }}>
          autobot
        </div>
      </div>
    ),
    size,
  );
}
