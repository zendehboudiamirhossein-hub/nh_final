"use client";

import { DeviceSummary, PairingItem } from "./types";
import { fmtMinutesShort, faDigits } from "./format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DevicesView } from "./devices-view";
import {
  Smartphone,
  Timer,
  ShieldCheck,
  KeyRound,
  TrendingUp,
  Activity,
  Clock,
  Sparkles,
} from "lucide-react";

function OverviewCard({
  icon,
  label,
  value,
  hint,
  iconClass,
  gradient,
  glowClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  iconClass: string;
  gradient: string;
  glowClass?: string;
}) {
  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${gradient} ${glowClass ?? ""}`}>
      {/* درخشش گرادینتی پس‌زمینه */}
      <div
        className={`absolute -top-8 -end-8 w-24 h-24 rounded-full opacity-15 blur-2xl ${iconClass.replace(
          "text-",
          "bg-"
        )}`}
        aria-hidden
      />
      <CardContent className="relative p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground">{label}</span>
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center bg-background/40 border border-border ${iconClass}`}
          >
            {icon}
          </div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function Dashboard({
  devices,
  codes,
  onOpenDetail,
}: {
  devices: DeviceSummary[];
  codes: PairingItem[];
  onOpenDetail: (id: string) => void;
}) {
  const totalToday = devices.reduce((s, d) => s + d.todayMinutes, 0);
  const totalWeek = devices.reduce((s, d) => s + d.weekMinutes, 0);
  const totalControlled = devices.reduce((s, d) => s + d.controlledCount, 0);
  const activeCodes = codes.filter(
    (c) => !c.used && new Date(c.expiresAt).getTime() > Date.now()
  ).length;

  const sorted = [...devices].sort((a, b) => b.todayMinutes - a.todayMinutes);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <OverviewCard
          icon={<Smartphone className="w-4 h-4 text-primary" />}
          iconClass="text-primary"
          label="دستگاه‌های متصل"
          value={faDigits(devices.length)}
          hint={
            devices.length > 0
              ? `${faDigits(devices.filter((d) => d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < 5 * 60000).length)} دستگاه آنلاین`
              : "هنوز دستگاهی متصل نشده"
          }
          gradient="from-primary/15 to-primary/5"
          glowClass="neon-glow-purple"
        />
        <OverviewCard
          icon={<Timer className="w-4 h-4 text-neon-green" />}
          iconClass="text-neon-green"
          label="کارکرد امروز"
          value={fmtMinutesShort(totalToday)}
          hint={`هفته: ${fmtMinutesShort(totalWeek)}`}
          gradient="from-neon-green/15 to-neon-green/5"
          glowClass="neon-glow-green"
        />
        <OverviewCard
          icon={<ShieldCheck className="w-4 h-4 text-neon-orange" />}
          iconClass="text-neon-orange"
          label="برنامه‌های کنترل‌شده"
          value={faDigits(totalControlled)}
          hint="در همه دستگاه‌ها"
          gradient="from-neon-orange/15 to-neon-pink/5"
        />
        <OverviewCard
          icon={<KeyRound className="w-4 h-4 text-neon-cyan" />}
          iconClass="text-neon-cyan"
          label="کدهای فعال"
          value={faDigits(activeCodes)}
          hint="برای اتصال دستگاه جدید"
          gradient="from-neon-cyan/15 to-primary/5"
        />
      </div>

      {devices.length > 0 && (
        <Card className="relative overflow-hidden bg-gradient-to-br from-secondary/40 to-transparent border-border">
          <div className="absolute -top-12 -start-12 w-40 h-40 rounded-full bg-neon-green/10 blur-3xl" aria-hidden />
          <CardHeader className="pb-3 relative">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4 text-neon-green" />
              پرمصرف‌ترین دستگاه‌های امروز
            </CardTitle>
            <CardDescription>مرتب‌شده بر اساس کارکرد امروز</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 relative">
            {sorted.slice(0, 3).map((d, i) => {
              const max = sorted[0].todayMinutes || 1;
              const pct = Math.max(4, (d.todayMinutes / max) * 100);
              const gradColors = [
                "from-neon-green/60 to-neon-green",
                "from-primary/60 to-primary",
                "from-neon-cyan/60 to-neon-cyan",
              ];
              return (
                <div key={d.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      <span
                        className={
                          i === 0
                            ? "text-neon-green"
                            : i === 1
                            ? "text-primary"
                            : "text-neon-cyan"
                        }
                      >
                        {faDigits(i + 1)}.
                      </span>{" "}
                      {d.name}
                    </span>
                    <span className="text-muted-foreground">
                      {fmtMinutesShort(d.todayMinutes)}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-secondary overflow-hidden border border-border">
                    <div
                      className={`h-full rounded-full bg-gradient-to-l ${gradColors[i]} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-neon-cyan" />
          <h3 className="text-sm font-semibold text-foreground">دستگاه‌ها</h3>
          {devices.length > 0 && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              برای جزئیات کامل هر کارت را بزنید
            </span>
          )}
        </div>
        <DevicesView devices={devices} onOpenDetail={onOpenDetail} />
      </div>
    </div>
  );
}
