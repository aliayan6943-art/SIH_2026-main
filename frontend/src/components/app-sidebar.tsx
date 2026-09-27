"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Users,
  Stethoscope,
  LayoutDashboard,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  MonitorSmartphone,
  Settings,
  HelpCircle,
} from "lucide-react";

interface Patient {
  id: string;
  name: string;
  is_emergency: boolean;
  status: string;
  chief_complaint?: string;
}

// Main navigation items — all linked and working
const NAV_ITEMS = [
  { title: "Patient Kiosk", url: "/", icon: MonitorSmartphone, desc: "Self-service terminal" },
  { title: "Reception Queue", url: "/reception", icon: Users, desc: "Live patient queue" },
  { title: "Doctor EMR", url: "/doctor", icon: Stethoscope, desc: "Clinical summary view" },
  { title: "Analytics", url: "/dashboard", icon: LayoutDashboard, desc: "OPD dashboard" },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [stats, setStats] = React.useState({ total: 0, ready: 0, emergency: 0 });

  React.useEffect(() => {
    const fetch_patients = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/patients");
        const data = await res.json();
        const list: Patient[] = data.patients || [];
        setPatients(list);
        setStats({
          total: list.length,
          ready: list.filter((p) => p.status === "Summary Ready").length,
          emergency: list.filter((p) => p.is_emergency).length,
        });
      } catch {
        // backend might not be up yet
      }
    };
    fetch_patients();
    const interval = setInterval(fetch_patients, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      {/* ── Header: Branding ── */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5! h-12"
              render={<a href="/" />}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Activity size={16} className="text-white" />
                </div>
                <div>
                  <span className="text-base font-bold text-slate-900">MediKiosk</span>
                  <p className="text-xs text-slate-400 leading-none">AI Clinical Platform</p>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* ── Live Stats ── */}
        <SidebarGroup>
          <div className="grid grid-cols-3 gap-2 px-3 py-2">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-slate-900">{stats.total}</p>
              <p className="text-[10px] text-slate-500">Total</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-green-700">{stats.ready}</p>
              <p className="text-[10px] text-green-600">Ready</p>
            </div>
            <div className={`border rounded-lg p-2 text-center ${stats.emergency > 0 ? "bg-red-50 border-red-300" : "bg-slate-50 border-slate-200"}`}>
              <p className={`text-lg font-bold ${stats.emergency > 0 ? "text-red-700 animate-pulse" : "text-slate-900"}`}>
                {stats.emergency}
              </p>
              <p className={`text-[10px] ${stats.emergency > 0 ? "text-red-500" : "text-slate-500"}`}>SOS</p>
            </div>
          </div>
        </SidebarGroup>

        <SidebarSeparator />

        {/* ── Main Navigation ── */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={<a href={item.url} />}
                      className={`${isActive ? "bg-blue-50 text-blue-700 border border-blue-200 font-semibold" : "hover:bg-slate-50"} rounded-lg transition-colors`}
                      tooltip={item.desc}
                    >
                      <item.icon size={16} className={isActive ? "text-blue-600" : "text-slate-500"} />
                      <span className="text-sm">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* ── Live Patient Queue ── */}
        <SidebarGroup>
          <SidebarGroupLabel>
            <span>Live Patient Queue</span>
            {patients.length > 0 && (
              <span className="ml-auto text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">
                {patients.length}
              </span>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {patients.length === 0 ? (
                <SidebarMenuItem>
                  <div className="px-3 py-2 text-xs text-slate-400 italic">No active patients</div>
                </SidebarMenuItem>
              ) : (
                patients.map((p) => (
                  <SidebarMenuItem key={p.id}>
                    <SidebarMenuButton
                      render={<a href={`/doctor?patientId=${p.id}`} />}
                      className="h-auto py-2 rounded-lg hover:bg-slate-50"
                      tooltip={p.chief_complaint || p.status}
                    >
                      <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${p.is_emergency ? "bg-red-100 text-red-700" : "bg-indigo-100 text-indigo-700"}`}>
                        {p.name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-700 truncate leading-tight">{p.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {p.is_emergency ? (
                            <><AlertTriangle size={9} className="text-red-500" /><span className="text-[9px] text-red-500 font-medium">Emergency</span></>
                          ) : p.status === "Summary Ready" ? (
                            <><CheckCircle size={9} className="text-green-500" /><span className="text-[9px] text-green-600">Ready</span></>
                          ) : (
                            <><Clock size={9} className="text-amber-500" /><span className="text-[9px] text-amber-600">In Session</span></>
                          )}
                        </div>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer: Doctor Profile ── */}
      <SidebarFooter>
        <SidebarSeparator />
        <div className="px-3 py-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            D
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800 truncate">Dr. Anuj Sharma</p>
            <p className="text-xs text-slate-400 truncate">Cardiology · On Duty</p>
          </div>
          <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" title="Online" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
