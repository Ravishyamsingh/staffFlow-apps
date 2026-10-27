import type { Metadata } from "next";
import "./globals.css";
import { AdminAuthProvider } from "../src/components/admin-auth";

export const metadata: Metadata = {
  title: "StaffFlow Admin",
  description: "StaffFlow operations command centre",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AdminAuthProvider>{children}</AdminAuthProvider></body></html>;
}
