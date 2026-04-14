import type { Metadata } from "next";
import { Header, Footer } from "@/components/public";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "MaintainEx - Book trusted help for home tasks",
  description: "Get skilled professionals for assembly, mounting, moving, cleaning, and more home tasks.",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}