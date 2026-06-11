import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { OperationalProvider } from "@/components/providers/OperationalProvider";
import PWARegister from "@/components/PWARegister";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400"],
});

export const metadata: Metadata = {
  title: "Aether — Today",
  description: "Operational intelligence for independent hotels.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Aether" },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#05070b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable}`}
    >
      <body>
        <PWARegister />
        {/*
          OperationalProvider este un Client Component ce:
            1. Deschide un canal Supabase Realtime pentru operational_incidents
            2. Hidratează starea cu incidentele deja deschise la boot
            3. Expune starea via React Context tuturor componentelor din arbore
            4. Gestionează cleanup corect al WebSocket-urilor (mountedRef + channelRef)
        */}
        <OperationalProvider>
          {children}
        </OperationalProvider>
      </body>
    </html>
  );
}
