"use client";

import { useCallback, useEffect, useState } from "react";
import { LoginScreen } from "@/components/panel/login-screen";
import { Dashboard } from "@/components/panel/dashboard";
import { DevicesView } from "@/components/panel/devices-view";
import { PairingView } from "@/components/panel/pairing-view";
import { DeviceDetail } from "@/components/panel/device-detail";
import { RestoreDialog } from "@/components/panel/backup-restore";
import { DeviceSummary, PairingItem } from "@/components/panel/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, RefreshCw, LogOut, Loader2, DatabaseBackup } from "lucide-react";

type Phase = "loading" | "login" | "panel";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [tab, setTab] = useState("dashboard");
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [codes, setCodes] = useState<PairingItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const refresh = useCallback(async () => {
    setDataLoading(true);
    try {
      const [devRes, codeRes] = await Promise.all([
        fetch("/api/admin/devices"),
        fetch("/api/admin/pairing"),
      ]);
      if (devRes.status === 401 || codeRes.status === 401) {
        setPhase("login");
        return;
      }
      if (devRes.ok) {
        const json = await devRes.json();
        setDevices(json.devices ?? []);
      }
      if (codeRes.ok) {
        const json = await codeRes.json();
        setCodes(json.codes ?? []);
      }
    } catch {
      // خطای گذرا — تلاش بعدی در چرخه بعدی
    } finally {
      setDataLoading(false);
    }
  }, []);

  // بررسی نشست هنگام باز شدن صفحه
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/session");
        const json = await res.json();
        setPhase(json.authenticated ? "panel" : "login");
      } catch {
        setPhase("login");
      }
    })();
  }, []);

  // بارگذاری داده‌ها + به‌روزرسانی خودکار هر ۳۰ ثانیه
  useEffect(() => {
    if (phase !== "panel") return;
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [phase, refresh]);

  async function logout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      // بی‌اهمیت
    }
    setDevices([]);
    setCodes([]);
    setDetailId(null);
    setPhase("login");
  }

  if (phase === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  if (phase === "login") {
    return <LoginScreen onSuccess={() => setPhase("panel")} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-lg">
        <div
          className="absolute inset-0 -z-10 opacity-50"
          style={{
            background:
              "linear-gradient(90deg, rgba(139,124,255,0.08) 0%, transparent 30%, transparent 70%, rgba(0,229,160,0.06) 100%)",
          }}
          aria-hidden
        />
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/30 to-neon-cyan/20 border border-primary/30 flex items-center justify-center neon-glow-purple">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold leading-tight bg-gradient-to-l from-primary via-foreground to-foreground bg-clip-text text-transparent">
              پنل مدیریت نگهبان
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight">
              کنترل سوژه — گزارش کارکرد و برنامه‌ها
            </p>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRestoreOpen(true)}
              className="gap-1.5 border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 hover:text-neon-cyan"
              title="بازیابی دستگاه از فایل بکاپ"
            >
              <DatabaseBackup className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">بازیابی بکاپ</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={dataLoading}
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${dataLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">به‌روزرسانی</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard">داشبورد</TabsTrigger>
            <TabsTrigger value="devices">
              دستگاه‌ها
              {devices.length > 0 && (
                <Badge variant="secondary" className="ms-1.5 px-1.5 min-w-5 justify-center">
                  {devices.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pairing">اتصال دستگاه</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Dashboard devices={devices} codes={codes} onOpenDetail={setDetailId} />
          </TabsContent>

          <TabsContent value="devices">
            <DevicesView devices={devices} onOpenDetail={setDetailId} />
          </TabsContent>

          <TabsContent value="pairing">
            <PairingView codes={codes} onRefresh={refresh} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          پنل مدیریت نگهبان — آمار مصرف و لیست برنامه‌های دستگاه‌های متصل
        </div>
      </footer>

      <DeviceDetail
        deviceId={detailId}
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        onDeleted={() => {
          // لیست دستگاه‌ها و آمار داشبورد دوباره بارگذاری می‌شوند
          refresh();
        }}
      />

      <RestoreDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        onRestored={() => {
          // پس از بازیابی موفق، لیست دستگاه‌ها refresh می‌شود تا دستگاه جدید
          // در پنل دیده شود. همچنین به تب دستگاه‌ها می‌رویم.
          setTab("devices");
          refresh();
        }}
      />
    </div>
  );
}
