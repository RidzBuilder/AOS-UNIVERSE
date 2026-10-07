import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AOS UNIVERSE",
  description: "AOS UNIVERSE reference implementation runtime surface"
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}