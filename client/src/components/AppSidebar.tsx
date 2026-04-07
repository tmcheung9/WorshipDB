import { Home, Upload, Settings, Music, Search, FolderOpen, Shield } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

const menuItems = [
  {
    title: "詩歌搜尋",
    url: "/",
    icon: Search,
    requiresAuth: false,
    description: "瀏覽詩歌庫",
  },
  {
    title: "上傳詩歌",
    url: "/upload",
    icon: Upload,
    requiresAuth: true,
    description: "新增詩歌",
  },
  {
    title: "後台管理",
    url: "/admin",
    icon: Shield,
    requiresAuth: true,
    description: "系統設定",
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/user'],
  });

  const visibleMenuItems = menuItems.filter(item =>
    !item.requiresAuth || user
  );

  return (
    <Sidebar className="border-r border-sidebar-border/50">
      <SidebarHeader className="border-b border-sidebar-border/30 px-4 py-5 bg-gradient-to-b from-sidebar/95 to-sidebar">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-sidebar-primary/20 blur-lg rounded-full" />
            <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-sidebar-primary via-sidebar-primary/90 to-sidebar-primary/80 shadow-lg hover:shadow-xl transition-shadow">
              <Music className="h-6 w-6 text-sidebar-primary-foreground" />
            </div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-bold text-sidebar-foreground leading-tight tracking-tight">
              詩歌歌曲庫
            </h1>
            <p className="text-xs text-sidebar-foreground/60 leading-tight font-medium">
              Hymn Library
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 mb-2.5 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            導覽選單
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1.5">
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.url === "/" ? "home" : item.url.slice(1)}`}
                    className="group relative hover:bg-transparent"
                  >
                    <Link href={item.url} className="flex items-center gap-3 px-3 py-3 rounded-lg transition-all">
                      <div className={`p-2 rounded-lg transition-all duration-200 ${
                        location === item.url
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg scale-105'
                          : 'bg-sidebar-accent/40 text-sidebar-foreground/70 group-hover:bg-sidebar-accent/70 group-hover:text-sidebar-foreground group-hover:scale-105'
                      }`}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 flex flex-col min-w-0">
                        <span className={`text-sm font-semibold transition-colors truncate ${
                          location === item.url
                            ? 'text-sidebar-foreground'
                            : 'text-sidebar-foreground/85 group-hover:text-sidebar-foreground'
                        }`}>
                          {item.title}
                        </span>
                        <span className={`text-xs transition-colors truncate ${
                          location === item.url
                            ? 'text-sidebar-foreground/65'
                            : 'text-sidebar-foreground/45 group-hover:text-sidebar-foreground/65'
                        }`}>
                          {item.description}
                        </span>
                      </div>
                      {location === item.url && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-sidebar-primary rounded-r-full shadow-md" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/30 px-4 py-3.5 bg-gradient-to-t from-sidebar/95 to-sidebar">
        <div className="flex items-center gap-2.5 text-xs text-sidebar-foreground/45 font-medium">
          <div className="p-1 rounded bg-sidebar-accent/30">
            <FolderOpen className="h-3.5 w-3.5" />
          </div>
          <span>敬拜詩歌管理系統</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
