import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { SimulatedUserBanner } from "@/components/SimulatedUserBanner";
import { getSimulatedUserId } from "@/lib/simulation";
import { createClient } from "@/lib/supabase/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stuber Bowl",
  description: "Super Bowl prop bet contest",
  manifest: "/manifest.json",
  icons: {
    icon: "/stuberbowl.png",
    apple: "/stuberbowl.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Stuber Bowl",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1d4ed8",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Check if simulating a user
  let simulatedUserName: string | null = null;
  const simulatedUserId = await getSimulatedUserId();

  if (simulatedUserId) {
    const supabase = await createClient();
    const { data: simUser } = await supabase
      .from("sb_profiles")
      .select("display_name")
      .eq("id", simulatedUserId)
      .single();

    if (simUser) {
      simulatedUserName = simUser.display_name;
    }
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black`}
      >
        {simulatedUserName && <SimulatedUserBanner userName={simulatedUserName} />}
        <main className={`min-h-screen pb-20 ${simulatedUserName ? "pt-12" : "pt-safe"}`}>
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
