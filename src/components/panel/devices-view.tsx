"use client";

import { DeviceSummary } from "./types";
import { fmtMinutesShort, timeAgo, faDigits } from "./format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryCharging,
  ShieldCheck,
  Timer,
  ChevronLeft,
  Activity,
  Cpu,
} from "lucide-react";

function BatteryIcon({ level }: { level: number | null }) {
  if (level === null) return <BatteryMedium className="w-4 h-4 text-muted-foreground" />;
  if (level <= 20) return <BatteryLow className="w-4 h-4 text-destructive" />;
  if (level >= 85) return <BatteryFull className="w-4 h-4 text-neon-green" />;
  return <BatteryMedium className="w-4 h-4 text-neon-orange" />;
}

export function DeviceStatus({ lastSeenAt }: { lastSeenAt: string | null }) {
  if (!lastSeenAt) return <Badge variant="outline" className="text-muted-foreground">متصل نشده</Badge>;
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < 5 * 60 * 1000)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-neon-green font-medium">
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-neon-green opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-green" />
        </span>
        آنلاین
      </span>
    );
  if (diff < 60 * 60 * 1000)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-neon-orange font-medium">
        <span className="w-2 h-2 rounded-full bg-neon-orange" />
        اخیراً فعال
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="w-2 h-2 rounded-full bg-muted-foreground" />
      آفلاین
    </span>
  );
}

/** هش رنگ پایدار بر اساس ID دستگاه — برای گرادینت آواتار */
function pickGradient(seed: string): { from: string; to: string; text: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const palettes = [
    { from: "from-primary/40", to: "to-neon-cyan/20", text: "text-primary" },
    { from: "from-neon-green/40", to: "to-neon-cyan/20", text: "text-neon-green" },
    { from: "from-neon-orange/40", to: "to-neon-pink/20", text: "text-neon-orange" },
    { from: "from-neon-pink/40", to: "to-primary/20", text: "text-neon-pink" },
    { from: "from-neon-cyan/40", to: "to-neon-green/20", text: "text-neon-cyan" },
  ];
  return palettes[h % palettes.length];
}

export function DevicesView({
  devices,
  onOpenDetail,
}: {
  devices: DeviceSummary[];
  onOpenDetail: (id: string) => void;
}) {
  if (devices.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center space-y-3">
          <Smartphone className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">
            هنوز هیچ دستگاهی متصل نشده است.
          </p>
          <p className="text-sm text-muted-foreground/70">
            از تب «اتصال دستگاه» یک کد جفت‌سازی بسازید و در اپ نگهبان وارد کنید.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {devices.map((d) => {
        const grad = pickGradient(d.id);
        const firstLetter = (d.name || "؟").trim().charAt(0) || "؟";
        return (
          <Card
            key={d.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpenDetail(d.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onOpenDetail(d.id);
            }}
            className="cursor-pointer hover:border-primary/60 hover:neon-glow-purple transition-all duration-300 group relative overflow-hidden"
          >
            {/* درخشش گرادینتی پس‌زمینه هنگام hover */}
            <div
              className="absolute -top-12 -end-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 bg-primary/10 blur-3xl transition-opacity duration-700"
              aria-hidden
            />

            <CardContent className="relative p-5 space-y-4">
              {/* هدر کارت: آواتار + نام + فلش */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`relative w-12 h-12 rounded-2xl bg-gradient-to-br ${grad.from} ${grad.to} border border-border flex items-center justify-center shrink-0`}
                  >
                    <span className={`text-xl font-bold ${grad.text}`}>
                      {firstLetter}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{d.name}</h3>
                    <p className="text-xs text-muted-foreground truncate" dir="ltr">
                      {d.model || "—"}
                    </p>
                  </div>
                </div>
                <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all shrink-0" />
              </div>

              {/* ردیف وضعیت و باتری */}
              <div className="flex items-center justify-between text-xs">
                <DeviceStatus lastSeenAt={d.lastSeenAt} />
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <BatteryIcon level={d.battery} />
                  {d.battery !== null ? faDigits(d.battery) + "٪" : "—"}
                </span>
              </div>

              {/* ردیف آمار: امروز + هفته */}
              <div className="grid grid-cols-2 gap-2">
                <div className="relative rounded-xl bg-gradient-to-br from-neon-green/10 to-transparent border border-neon-green/20 py-2.5 px-2 overflow-hidden">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground text-[11px] mb-1">
                    <Timer className="w-3.5 h-3.5" />
                    امروز
                  </div>
                  <div className="font-bold text-neon-green text-sm">
                    {fmtMinutesShort(d.todayMinutes)}
                  </div>
                  <Activity className="absolute -bottom-2 -start-2 w-8 h-8 text-neon-green/10" />
                </div>
                <div className="relative rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 py-2.5 px-2 overflow-hidden">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground text-[11px] mb-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    کنترل‌شده
                  </div>
                  <div className="font-bold text-primary text-sm">
                    {faDigits(d.controlledCount)} از {faDigits(d.appCount)}
                  </div>
                  <Cpu className="absolute -bottom-2 -start-2 w-8 h-8 text-primary/10" />
                </div>
              </div>

              {/* فوتر: آخرین همگام‌سازی */}
              <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  همگام‌سازی: {timeAgo(d.lastSyncAt)}
                </p>
                <p className="text-[11px] text-muted-foreground" dir="ltr">
                  {faDigits(d.weekMinutes)} دق/هفته
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export { BatteryIcon };
