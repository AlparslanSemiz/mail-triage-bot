import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mail Triage Bot",
  description: "AI-powered email triage for Outlook",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          margin: 0,
          padding: 0,
          backgroundColor: "#0a0a0a",
          color: "#e5e5e5",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
