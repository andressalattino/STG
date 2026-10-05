import type { Metadata } from "next";
import PasswordRecovery from "@/features/auth/PasswordRecovery";

export const metadata: Metadata = {
  title: "Recuperar acceso",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return <PasswordRecovery />;
}
