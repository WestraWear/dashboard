"use client";

import Sidebar from "@/components/Sidebar";
import TopNavbar from "@/components/TopNavbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNavbar />
        <main className="flex-1 overflow-y-auto bg-background pb-[60px] md:pb-0">{children}</main>
      </div>
    </>
  );
}
