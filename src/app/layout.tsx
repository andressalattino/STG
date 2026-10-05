import type { Metadata } from "next";
import "@/styles.css";
export const metadata: Metadata = {
  title: { default: "STG Viajes y Turismo", template: "%s | STG Turismo" },
  description:
    "Viajes organizados, salidas grupales y atención personalizada en Mendoza.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
