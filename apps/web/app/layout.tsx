import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "SONORA", description: "SONORA: a spatial music venue and acoustic designer. Simplified prediction, not certified acoustic engineering. All data is synthetic." };
export const viewport: Viewport = { themeColor: "#070708", width: "device-width", initialScale: 1 };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
