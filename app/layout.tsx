import type { Metadata } from "next";
import { Space_Grotesk, Manrope } from "next/font/google";
import "./globals.css";

const titleFont = Space_Grotesk({ subsets: ["latin"], variable: "--font-title" });
const bodyFont = Manrope({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Descargador Multimedia Local",
  description: "Aplicación local para análisis y descarga de contenido multimedia compatible"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${titleFont.variable} ${bodyFont.variable} antialiased`}>{children}</body>
    </html>
  );
}
