"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={{
        embeddedWallets: {
          createOnLogin: "all-users",
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
