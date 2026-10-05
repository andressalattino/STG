import type { ReactNode } from "react";
import App from "@/App";

// Keep the editor and receipts in one mounted workspace as the route changes.
export default function AdminWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <App />
      {children}
    </>
  );
}
