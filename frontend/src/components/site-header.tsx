"use client";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MonitorSmartphone, Users, Stethoscope, LayoutDashboard } from "lucide-react";

const PAGE_META: Record<string, { title: string; icon: React.ElementType; badge?: string }> = {
  "/": { title: "Patient Kiosk", icon: MonitorSmartphone },
  "/reception": { title: "Reception Queue", icon: Users, badge: "Live" },
  "/doctor": { title: "Physician EMR", icon: Stethoscope },
  "/dashboard": { title: "OPD Analytics", icon: LayoutDashboard },
};

export function SiteHeader() {
  const pathname = usePathname();
  // Match exact or prefix (e.g. /doctor?patientId=...)
  const meta =
    PAGE_META[pathname] ??
    Object.entries(PAGE_META).find(([k]) => k !== "/" && pathname.startsWith(k))?.[1] ??
    { title: "MediKiosk", icon: MonitorSmartphone };

  const Icon = meta.icon;

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-white transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
        <Icon size={16} className="text-slate-500" />
        <h1 className="text-sm font-semibold text-slate-800">{meta.title}</h1>
        {meta.badge && (
          <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
            {meta.badge}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-400">MediKiosk AI Platform</span>
          <div className="w-2 h-2 bg-green-500 rounded-full" title="Backend connected" />
        </div>
      </div>
    </header>
  );
}
