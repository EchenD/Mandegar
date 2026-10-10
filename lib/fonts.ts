import localFont from "next/font/local";

export const rokhFaNum = localFont({
  src: [
    { path: "../styles/fonts/rokh-fa-num/RokhFaNum-Regular.woff2", weight: "400", style: "normal" },
    { path: "../styles/fonts/rokh-fa-num/RokhFaNum-Medium.woff2", weight: "500", style: "normal" },
    { path: "../styles/fonts/rokh-fa-num/RokhFaNum-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../styles/fonts/rokh-fa-num/RokhFaNum-Bold.woff2", weight: "700", style: "normal" },
    { path: "../styles/fonts/rokh-fa-num/RokhFaNum-ExtraBold.woff2", weight: "800", style: "normal" },
    { path: "../styles/fonts/rokh-fa-num/RokhFaNum-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-rokh-fa-num",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
