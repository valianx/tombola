import type { Metadata } from "next";
import "bootstrap/dist/css/bootstrap.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gran Ruleta Juegalo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Titillium+Web:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
