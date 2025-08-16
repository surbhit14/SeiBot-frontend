import Providers from "../components/Providers";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>SeiBot</title>
        <meta name="description" content="SeiBot" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
