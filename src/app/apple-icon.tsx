import { ImageResponse } from "next/og";

/*
  Apple touch icon (180×180 PNG), gegenereerd at build time uit hetzelfde
  stoomwolkjes-motief als icon.svg zodat er geen los PNG-bestand bijgehouden
  hoeft te worden.
*/

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#c1592a",
          borderRadius: 40,
        }}
      >
        <svg width="130" height="130" viewBox="0 0 64 64">
          <g fill="none" stroke="#f7f2ea" strokeWidth="4.5" strokeLinecap="round">
            <path d="M21 16c0 5-5 6.5-5 11.5S21 34 21 39" />
            <path d="M33 13c0 5.5-5.5 7.5-5.5 13S33 33.5 33 39.5" />
            <path d="M45 16c0 5-5 6.5-5 11.5S45 34 45 39" />
          </g>
          <path d="M14 47h36" stroke="#f7f2ea" strokeWidth="4.5" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size,
  );
}
