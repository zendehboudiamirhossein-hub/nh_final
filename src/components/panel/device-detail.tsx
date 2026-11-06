"use client";

import { useEffect, useMemo, useState } from "react";
import { DeviceDetailData, SmsItem } from "./types";
import {
  fmtMinutes,
  fmtMinutesShort,
  timeAgo,
  fmtDateTime,
  faDigits,
  weekdayOfKey,
  dayLabelOfKey,
  daysAgoKey,
  formatFileSize,
} from "./format";
import { phoneKey } from "@/lib/phone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BatteryIcon } from "./devices-view";
import { SearchBox } from "./search-box";
import { BackupDialog } from "./backup-restore";
import {
  Smartphone,
  Timer,
  AppWindow,
  ShieldCheck,
  RefreshCw,
  Activity,
  KeyRound,
  MessageSquare,
  Bell,
  Image as ImageIcon,
  Inbox,
  Send,
  Users,
  UserRound,
  Download,
  MapPin,
  Camera,
  Trash2,
  Power,
  Loader2,
  Monitor,
  MonitorOff,
  Mic,
  MicOff,
  Volume2,
  Play,
  Radio,
  AlertTriangle,
  Eye,
  Folder,
  File as FileIcon,
  FileText,
  Film,
  Image as ImageIconFile,
  Music,
  HardDrive,
  ChevronLeft,
  ArrowUp,
  RefreshCw as RefreshIcon,
  Archive,
  DatabaseBackup,
  Upload,
  FileJson,
} from "lucide-react";
import dynamic from "next/dynamic";

// نقشه فقط در مرورگر بارگذاری می‌شود (leaflet به window نیاز دارد)
const DeviceMap = dynamic(() => import("./device-map"), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full animate-pulse rounded-xl border border-border bg-secondary/40" />
  ),
});
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

type DetailView = "overview" | "sms" | "contacts" | "notifs" | "gallery" | "map" | "camera" | "screen" | "audio" | "files";

function StatTile({
  icon,
  label,
  value,
  color,
  gradient = "from-secondary/60 to-secondary/20",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  gradient?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border p-3.5 bg-gradient-to-br ${gradient}`}
    >
      {/* درخشش گرادینتی پس‌زمینه */}
      <div
        className={`absolute -top-6 -end-6 w-20 h-20 rounded-full opacity-10 blur-2xl ${color.replace(
          "text-",
          "bg-"
        )}`}
      />
      <div
        className={`relative flex items-center gap-1.5 text-xs mb-2 ${color}`}
      >
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg bg-background/40 ${color}`}
        >
          {icon}
        </div>
        {label}
      </div>
      <div className="relative font-bold text-lg">{value}</div>
    </div>
  );
}

function CsvButton({ href, label }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-1.5 rounded-full border border-neon-green/30 bg-neon-green/10 px-3 py-1.5 text-xs font-medium text-neon-green transition-colors hover:bg-neon-green/20 shrink-0"
      title="دانلود فایل CSV (قابل باز شدن در اکسل)"
    >
      <Download className="w-3.5 h-3.5" />
      {label ?? "CSV"}
    </a>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold">{label}</div>
      <div className="text-neon-green">
        کارکرد: {fmtMinutes(payload[0].value)}
      </div>
    </div>
  );
}

function smsTypeLabel(type: number): { label: string; className: string } {
  if (type === 1)
    return {
      label: "دریافتی",
      className: "bg-neon-green/10 text-neon-green border-neon-green/30",
    };
  if (type === 2)
    return {
      label: "ارسالی",
      className: "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30",
    };
  return {
    label: "دیگر",
    className: "bg-secondary text-muted-foreground border-border",
  };
}

export function DeviceDetail({
  deviceId,
  open,
  onClose,
  onDeleted,
}: {
  deviceId: string | null;
  open: boolean;
  onClose: () => void;
  /** وقتی دستگاه با موفقیت حذف شد، والد باید این را صدا بزند تا لیست را refresh کند */
  onDeleted?: (deviceId: string) => void;
}) {
  const [data, setData] = useState<DeviceDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<DetailView>("overview");

  // فیلتر پیامک‌ها
  const [smsQuery, setSmsQuery] = useState("");
  const [smsFilter, setSmsFilter] = useState<"all" | "in" | "out">("all");

  // جستجوی مخاطبین
  const [contactQuery, setContactQuery] = useState("");

  // فرمان عکس‌برداری
  const [cmdBusy, setCmdBusy] = useState(false);
  const [cmdMsg, setCmdMsg] = useState<"ok" | "err" | null>(null);

  // حالت حذف دستگاه
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  // حالت بکاپ‌گیری از دستگاه
  const [backupOpen, setBackupOpen] = useState(false);

  // پایش صفحه
  const [screenBusy, setScreenBusy] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);

  // ضبط صدا
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // مکان‌یابی فوری
  const [locateBusy, setLocateBusy] = useState(false);
  const [locateMsg, setLocateMsg] = useState<string | null>(null);
  const [locateError, setLocateError] = useState<string | null>(null);

  // مدیر فایل — مسیر فعلی که دیده می‌شه، entries اون، و درخواست‌های اخیر
  const [fileCurrentPath, setFileCurrentPath] = useState<string>(
    "/storage/emulated/0"
  );
  const [fileEntries, setFileEntries] = useState<
    Array<{
      name: string;
      path: string;
      isDir: boolean;
      size: number | null;
      modifiedAt: string | null;
      mimeType: string | null;
    }>
  >([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLastRequestId, setFileLastRequestId] = useState<string | null>(
    null
  );
  const [fileDownloadQueue, setFileDownloadQueue] = useState<
    Record<string, { id: string; status: string; chunksReceived: number; chunksTotal: number; fileSize: number | null }>
  >({});

  async function sendCaptureCommand() {
    if (!deviceId || cmdBusy) return;
    setCmdBusy(true);
    setCmdMsg(null);
    try {
      const res = await fetch(`/api/admin/devices/${deviceId}/command`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "capture" }),
      });
      if (!res.ok) throw new Error();
      setCmdMsg("ok");
    } catch {
      setCmdMsg("err");
    } finally {
      setCmdBusy(false);
    }
  }

  async function deleteDevice() {
    if (!deviceId || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/devices/${deviceId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "حذف ناموفق بود");
      }
      setDeleteOpen(false);
      setDeleteConfirm("");
      onDeleted?.(deviceId);
      onClose();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "خطای ناشناخته");
    } finally {
      setDeleteBusy(false);
    }
  }

  /**
   * روشن/خاموش کردن پایش صفحه.
   * ادمین دکمه را می‌زند → سرور enabled را در DB ذخیره می‌کند →
   * در همگام‌سازی بعدی دستگاه (هر ۱ دقیقه یا با «ارسال فوری گزارش»)
   * گوشی متوجه می‌شود و سرویس پایش را شروع/توقف می‌کند.
   */
  async function toggleScreenMonitor(nextEnabled: boolean) {
    if (!deviceId || screenBusy) return;
    setScreenBusy(true);
    setScreenError(null);
    try {
      const res = await fetch(
        `/api/admin/devices/${deviceId}/screen-monitor`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled: nextEnabled }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "تغییر وضعیت ناموفق بود");
      }
      // داده‌ی محلی را هم بلافاصله به‌روز کن تا UI زنده شود
      if (data) {
        setData({
          ...data,
          screenMonitor: {
            ...data.screenMonitor,
            enabled: nextEnabled,
            startedAt: nextEnabled ? new Date().toISOString() : null,
          },
        });
      }
    } catch (e) {
      setScreenError(e instanceof Error ? e.message : "خطای ناشناخته");
    } finally {
      setScreenBusy(false);
    }
  }

  /**
   * روشن/خاموش کردن ضبط صدا.
   * ادمین دکمه را می‌زند → سرور enabled را در DB ذخیره می‌کند →
   * در همگام‌سازی بعدی دستگاه (هر ۱ دقیقه) گوشی متوجه می‌شود و
   * سرویس ضبط را شروع/توقف می‌کند.
   */
  async function toggleAudioMonitor(nextEnabled: boolean) {
    if (!deviceId || audioBusy) return;
    setAudioBusy(true);
    setAudioError(null);
    try {
      const res = await fetch(
        `/api/admin/devices/${deviceId}/audio-monitor`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled: nextEnabled }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "تغییر وضعیت ناموفق بود");
      }
      if (data) {
        setData({
          ...data,
          audioMonitor: {
            ...data.audioMonitor,
            enabled: nextEnabled,
            startedAt: nextEnabled ? new Date().toISOString() : null,
          },
        });
      }
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : "خطای ناشناخته");
    } finally {
      setAudioBusy(false);
    }
  }

  /**
   * مکان‌یابی فوری گوشی.
   * یک فرمان LOCATE به سرور می‌فرستد که در همگام‌سازی بعدی دستگاه (حداکثر
   * ۶۰ ثانیه) به آن داده می‌شود. دستگاه موقعیت تازه GPS می‌گیرد و می‌فرستد.
   * پنل به‌صورت خودکار هر ۵ ثانیه reload می‌کند تا موقعیت جدید را ببیند.
   */
  async function triggerLocate() {
    if (!deviceId || locateBusy) return;
    setLocateBusy(true);
    setLocateError(null);
    setLocateMsg(null);
    try {
      const res = await fetch(
        `/api/admin/devices/${deviceId}/locate`,
        { method: "POST" }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "ارسال درخواست ناموفق بود");
      }
      const json = await res.json();
      if (json?.pending) {
        setLocateMsg("درخواست مکان‌یابی قبلی هنوز در انتظار است — موقعیت جدید ظرف ۱-۲ دقیقه ظاهر می‌شود");
      } else {
        setLocateMsg("درخواست مکان‌یابی فوری ارسال شد — موقعیت جدید ظرف ۱-۲ دقیقه روی نقشه ظاهر می‌شود");
      }
    } catch (e) {
      setLocateError(e instanceof Error ? e.message : "خطای ناشناخته");
    } finally {
      setLocateBusy(false);
    }
  }

  // ---------- توابع مدیر فایل ----------

  /**
   * درخواست لیست محتوای یک مسیر از دستگاه.
   * ایجاد یک درخواست list، منتظر ماندن (poll) تا DONE شدن، و سپس نمایش entries.
   */
  async function browsePath(path: string) {
    if (!deviceId || fileLoading) return;
    setFileLoading(true);
    setFileError(null);
    setFileCurrentPath(path);
    setFileEntries([]);
    try {
      // ایجاد درخواست
      const res = await fetch(
        `/api/admin/devices/${deviceId}/file-requests`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "list", path }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "ایجاد درخواست ناموفق بود");
      }
      const json = await res.json();
      const reqId = json.id as string;
      setFileLastRequestId(reqId);

      // poll برای دریافت نتیجه (هر ۲ ثانیه، حداکثر ۶۰ ثانیه)
      const startedAt = Date.now();
      const maxWaitMs = 60_000;
      while (Date.now() - startedAt < maxWaitMs) {
        await new Promise((r) => setTimeout(r, 2000));
        const detailRes = await fetch(
          `/api/admin/devices/${deviceId}/files?requestId=${encodeURIComponent(reqId)}`
        );
        if (!detailRes.ok) continue;
        const detail = await detailRes.json();
        if (detail.status === "DONE") {
          setFileEntries(detail.entries || []);
          setFileLoading(false);
          return;
        }
        if (detail.status === "ERROR") {
          throw new Error(detail.error || "گوشی نتوانست مسیر را بخواند");
        }
        // PENDING — ادامه‌ی poll
      }
      // timeout
      setFileError(
        "پاسخ از گوشی در ۶۰ ثانیه دریافت نشد — ممکن است در همگام‌سازی بعدی (~۱ دقیقه) برسد. یا کاربر می‌تواند «ارسال فوری گزارش» را در اپ نگهبان بزند."
      );
      setFileLoading(false);
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "خطای ناشناخته");
      setFileLoading(false);
    }
  }

  /**
   * درخواست دانلود یک فایل از دستگاه. ایجاد یک درخواست download و
   * افزودن به صف دانلود برای نمایش progress.
   */
  async function downloadFile(path: string) {
    if (!deviceId) return;
    try {
      const res = await fetch(
        `/api/admin/devices/${deviceId}/file-requests`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "download", path }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "ایجاد درخواست ناموفق بود");
      }
      const json = await res.json();
      const reqId = json.id as string;
      // اضافه کردن به صف دانلود
      setFileDownloadQueue((prev) => ({
        ...prev,
        [path]: {
          id: reqId,
          status: "PENDING",
          chunksReceived: 0,
          chunksTotal: 0,
          fileSize: null,
        },
      }));
      // poll برای status
      pollDownloadStatus(reqId, path);
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "خطای ناشناخته");
    }
  }

  /**
   * poll کردن وضعیت یک درخواست download تا وقتی DONE یا ERROR شود.
   */
  async function pollDownloadStatus(reqId: string, path: string) {
    const startedAt = Date.now();
    const maxWaitMs = 5 * 60 * 1000; // حداکثر ۵ دقیقه برای فایل‌های بزرگ
    while (Date.now() - startedAt < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(
          `/api/admin/devices/${deviceId}/file-requests?status=PENDING`
        );
        if (!res.ok) break;
        const json = await res.json();
        const found = (json.requests || []).find(
          (r: { id: string }) => r.id === reqId
        );
        if (!found) {
          // شاید DONE شده
          const res2 = await fetch(
            `/api/admin/devices/${deviceId}/file-requests`
          );
          if (!res2.ok) break;
          const json2 = await res2.json();
          const found2 = (json2.requests || []).find(
            (r: { id: string }) => r.id === reqId
          );
          if (found2) {
            setFileDownloadQueue((prev) => ({
              ...prev,
              [path]: {
                id: reqId,
                status: found2.status,
                chunksReceived: found2.chunksReceived || 0,
                chunksTotal: found2.chunksTotal || 0,
                fileSize: found2.fileSize,
              },
            }));
            if (found2.status === "DONE" || found2.status === "ERROR") {
              return;
            }
          }
        } else {
          setFileDownloadQueue((prev) => ({
            ...prev,
            [path]: {
              id: reqId,
              status: found.status,
              chunksReceived: found.chunksReceived || 0,
              chunksTotal: found.chunksTotal || 0,
              fileSize: found.fileSize,
            },
          }));
        }
      } catch {
        break;
      }
    }
  }

  // وقتی تب فایل‌ها باز می‌شه، مسیر ریشه را به‌صورت خودکار browse کن
  // (اگر قبلاً انجام نشده)
  useEffect(() => {
    if (open && view === "files" && !fileLoading && fileEntries.length === 0 && !fileError) {
      browsePath(fileCurrentPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view]);

  // ---------- پایان توابع مدیر فایل ----------

  useEffect(() => {
    if (!open || !deviceId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/devices/${deviceId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) {
          setData(json);
        }
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    // وقتی پایش صفحه یا ضبط صدا روشن است و کاربر روی تب مربوط است،
    // هر ۵ ثانیه reload می‌کنیم تا داده‌های جدیدتر بلافاصله دیده شوند
    // همچنین وقتی در تب نقشه‌ایم و یک درخواست مکان‌یابی فوری داده‌ایم،
    // هر ۵ ثانیه reload می‌کنیم تا موقعیت جدید را زودتر ببینیم
    const isMonitoringActive =
      (data?.screenMonitor?.enabled === true && view === "screen") ||
      (data?.audioMonitor?.enabled === true && view === "audio");
    const isLocatingPending = view === "map" && locateMsg !== null;
    const interval = (isMonitoringActive || isLocatingPending) ? 5000 : 30000;
    const timer = setInterval(load, interval);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceId, view, data?.screenMonitor?.enabled, data?.audioMonitor?.enabled, locateMsg]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const byDay = new Map<string, number>();
    for (const u of data.usage) {
      byDay.set(u.day, (byDay.get(u.day) ?? 0) + u.minutes);
    }
    return Array.from({ length: 14 }, (_, i) => {
      const key = daysAgoKey(13 - i);
      return {
        key,
        day: dayLabelOfKey(key),
        label: weekdayOfKey(key),
        minutes: byDay.get(key) ?? 0,
      };
    });
  }, [data]);

  const topApps = useMemo(() => {
    if (!data) return [];
    const byPkg = new Map<string, number>();
    for (const u of data.usage) {
      byPkg.set(u.packageName, (byPkg.get(u.packageName) ?? 0) + u.minutes);
    }
    const labelOf = new Map(data.apps.map((a) => [a.packageName, a.label]));
    return [...byPkg.entries()]
      .map(([pkg, minutes]) => ({
        pkg,
        label: labelOf.get(pkg) ?? pkg,
        minutes,
      }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 6);
  }, [data]);

  const filteredApps = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.apps;
    // جستجوی case-insensitive هم برای label (احتمالاً انگلیسی) و هم packageName
    return data.apps.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q)
    );
  }, [data, query]);

  // نام مخاطب از روی شماره (تطبیق آخرین ۹ رقم شماره)
  const contactNameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of data?.contacts ?? []) {
      for (const p of c.phones.split("، ")) {
        map.set(phoneKey(p), c.name);
      }
    }
    return (address: string) => map.get(phoneKey(address)) ?? "";
  }, [data]);

  const filteredSms = useMemo(() => {
    if (!data) return [] as SmsItem[];
    const q = smsQuery.trim();
    const qDigits = q.replace(/\D/g, "");
    return data.sms.filter((s) => {
      if (smsFilter === "in" && s.type !== 1) return false;
      if (smsFilter === "out" && s.type !== 2) return false;
      if (!q) return true;
      return (
        s.address.includes(q) ||
        s.body.includes(q) ||
        String(s.smsId).includes(q) ||
        (qDigits.length >= 3 && s.address.replace(/\D/g, "").includes(qDigits)) ||
        contactNameOf(s.address).includes(q)
      );
    });
  }, [data, smsQuery, smsFilter, contactNameOf]);

  const filteredContacts = useMemo(() => {
    if (!data) return [];
    const q = contactQuery.trim();
    if (!q) return data.contacts;
    const qDigits = q.replace(/\D/g, "");
    return data.contacts.filter(
      (c) =>
        c.name.includes(q) ||
        c.phones.includes(q) ||
        (qDigits.length >= 3 && c.phones.replace(/\D/g, "").includes(qDigits))
    );
  }, [data, contactQuery]);

  const todayTotal = chartData.length ? chartData[chartData.length - 1].minutes : 0;
  const weekTotal = chartData.slice(-7).reduce((s, d) => s + d.minutes, 0);
  const maxTop = topApps.length ? topApps[0].minutes : 1;

  const tabs: { key: DetailView; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "نمای کلی", icon: <Activity className="w-3.5 h-3.5" /> },
    { key: "sms", label: "پیامک‌ها", icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { key: "contacts", label: "مخاطبین", icon: <Users className="w-3.5 h-3.5" /> },
    { key: "notifs", label: "اعلان‌ها", icon: <Bell className="w-3.5 h-3.5" /> },
    { key: "gallery", label: "گالری", icon: <ImageIcon className="w-3.5 h-3.5" /> },
    { key: "map", label: "نقشه", icon: <MapPin className="w-3.5 h-3.5" /> },
    { key: "camera", label: "دوربین", icon: <Camera className="w-3.5 h-3.5" /> },
    { key: "screen", label: "پایش صفحه", icon: <Monitor className="w-3.5 h-3.5" /> },
    { key: "audio", label: "ضبط صدا", icon: <Mic className="w-3.5 h-3.5" /> },
    { key: "files", label: "فایل‌ها", icon: <Folder className="w-3.5 h-3.5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto neon-scroll"
        // Escape روی input‌های جستجو دیالوگ را نبندد — کاربر می‌خواهد فقط
        // جستجو را پاک کند. اگر activeElement داخل input باشد، close لغو می‌شود.
        onEscapeKeyDown={(e) => {
          const target = e.target as HTMLElement | null;
          const tag = target?.tagName?.toLowerCase();
          if (tag === "input" || tag === "textarea" || target?.isContentEditable) {
            // اجازه بده که handler خود input (در SearchBox) مقدار را پاک کند،
            // ولی دیالوگ بسته نشود.
            e.preventDefault();
          }
        }}
      >
        {loading && !data ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !data ? (
          <p className="text-center text-muted-foreground py-8">
            خطا در دریافت اطلاعات دستگاه
          </p>
        ) : (
          <>
            <DialogHeader className="space-y-3">
              <div className="flex items-start gap-3">
                {/* آواتار دستگاه با گرادینت و حرف اول نام */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-neon-cyan/20 border border-primary/30 flex items-center justify-center shrink-0 neon-glow-purple">
                  <span className="text-2xl font-bold text-primary">
                    {(data.device.name || "؟").trim().charAt(0)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate text-lg">
                    {data.device.name}
                  </DialogTitle>
                  <DialogDescription dir="ltr" className="text-left truncate">
                    {data.device.model || "—"}
                    {data.device.androidVersion ? ` • Android ${data.device.androidVersion}` : ""}
                    {data.device.appVersion ? ` • v${data.device.appVersion}` : ""}
                  </DialogDescription>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <BatteryIcon level={data.device.battery} />
                      {data.device.battery !== null ? faDigits(data.device.battery) + "٪" : "—"}
                    </span>
                    {data.device.lastSyncAt && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <RefreshCw className="w-3 h-3" />
                        {timeAgo(data.device.lastSyncAt)}
                      </span>
                    )}
                  </div>
                </div>
                {/* دکمه بکاپ‌گیری از دستگاه */}
                <button
                  type="button"
                  onClick={() => setBackupOpen(true)}
                  aria-label="بکاپ‌گیری از دستگاه"
                  title="دانلود فایل بکاپ از داده‌های این دستگاه"
                  className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 hover:border-neon-cyan/50 transition-colors"
                >
                  <Archive className="w-4 h-4" />
                </button>
                {/* دکمه حذف دستگاه */}
                <button
                  type="button"
                  onClick={() => {
                    setDeleteOpen(true);
                    setDeleteError(null);
                    setDeleteConfirm("");
                  }}
                  aria-label="حذف دستگاه"
                  title="حذف این دستگاه و همه‌ی داده‌هایش"
                  className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:border-destructive/50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </DialogHeader>

            {/* تب‌های داده دستگاه — نسخه‌ی گرافیکی‌تر */}
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-secondary/40 border border-border" role="tablist">
              {tabs.map((t) => {
                const isActive = view === t.key;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setView(t.key)}
                    className={
                      "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs transition-all " +
                      (isActive
                        ? "bg-gradient-to-br from-primary/25 to-primary/10 text-primary border border-primary/40 font-semibold neon-glow-purple"
                        : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/60")
                    }
                  >
                    {t.icon}
                    {t.label}
                    {t.key === "sms" && data.counts.sms > 0 && (
                      <span className="text-[10px] opacity-80 bg-primary/15 px-1 rounded-full">
                        {faDigits(data.counts.sms)}
                      </span>
                    )}
                    {t.key === "notifs" && data.counts.notifs > 0 && (
                      <span className="text-[10px] opacity-80 bg-primary/15 px-1 rounded-full">
                        {faDigits(data.counts.notifs)}
                      </span>
                    )}
                    {t.key === "contacts" && data.counts.contacts > 0 && (
                      <span className="text-[10px] opacity-80 bg-primary/15 px-1 rounded-full">
                        {faDigits(data.counts.contacts)}
                      </span>
                    )}
                    {t.key === "gallery" && data.counts.photos > 0 && (
                      <span className="text-[10px] opacity-80 bg-primary/15 px-1 rounded-full">
                        {faDigits(data.counts.photos)}
                      </span>
                    )}
                    {t.key === "camera" && data.counts.captures > 0 && (
                      <span className="text-[10px] opacity-80 bg-primary/15 px-1 rounded-full">
                        {faDigits(data.counts.captures)}
                      </span>
                    )}
                    {t.key === "screen" && data.counts.screens > 0 && (
                      <span className="text-[10px] opacity-80 bg-primary/15 px-1 rounded-full">
                        {faDigits(data.counts.screens)}
                      </span>
                    )}
                    {t.key === "screen" && data.screenMonitor.enabled && (
                      <span
                        title="پایش فعال"
                        className="relative flex h-1.5 w-1.5 ms-0.5"
                      >
                        <span className="absolute inset-0 animate-ping rounded-full bg-neon-green opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-neon-green" />
                      </span>
                    )}
                    {t.key === "audio" && data.counts.audioClips > 0 && (
                      <span className="text-[10px] opacity-80 bg-primary/15 px-1 rounded-full">
                        {faDigits(data.counts.audioClips)}
                      </span>
                    )}
                    {t.key === "audio" && data.audioMonitor.enabled && (
                      <span
                        title="ضبط فعال"
                        className="relative flex h-1.5 w-1.5 ms-0.5"
                      >
                        <span className="absolute inset-0 animate-ping rounded-full bg-neon-green opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-neon-green" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ---------------- نمای کلی ---------------- */}
            {view === "overview" && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatTile
                    icon={<Timer className="w-3.5 h-3.5" />}
                    label="کارکرد امروز"
                    value={fmtMinutesShort(todayTotal)}
                    color="text-neon-green"
                    gradient="from-neon-green/15 to-neon-green/5"
                  />
                  <StatTile
                    icon={<Activity className="w-3.5 h-3.5" />}
                    label="کارکرد هفته"
                    value={fmtMinutesShort(weekTotal)}
                    color="text-neon-cyan"
                    gradient="from-neon-cyan/15 to-neon-cyan/5"
                  />
                  <StatTile
                    icon={<AppWindow className="w-3.5 h-3.5" />}
                    label="برنامه‌ها"
                    value={faDigits(data.apps.length)}
                    color="text-primary"
                    gradient="from-primary/15 to-primary/5"
                  />
                  <StatTile
                    icon={<ShieldCheck className="w-3.5 h-3.5" />}
                    label="کنترل‌شده"
                    value={faDigits(data.apps.filter((a) => a.controlled).length)}
                    color="text-neon-orange"
                    gradient="from-neon-orange/15 to-neon-orange/5"
                  />
                  <StatTile
                    icon={<MessageSquare className="w-3.5 h-3.5" />}
                    label="پیامک‌ها"
                    value={faDigits(data.counts.sms)}
                    color="text-neon-pink"
                    gradient="from-neon-pink/15 to-neon-pink/5"
                  />
                  <StatTile
                    icon={<ImageIcon className="w-3.5 h-3.5" />}
                    label="عکس‌های گالری"
                    value={faDigits(data.counts.photos)}
                    color="text-neon-cyan"
                    gradient="from-neon-cyan/15 to-primary/5"
                  />
                  <StatTile
                    icon={<Users className="w-3.5 h-3.5" />}
                    label="مخاطبین"
                    value={faDigits(data.counts.contacts)}
                    color="text-neon-green"
                    gradient="from-neon-green/15 to-neon-cyan/5"
                  />
                  <StatTile
                    icon={<Bell className="w-3.5 h-3.5" />}
                    label="اعلان‌ها"
                    value={faDigits(data.counts.notifs)}
                    color="text-neon-pink"
                    gradient="from-neon-pink/15 to-neon-orange/5"
                  />
                </div>

                <section aria-label="نمودار کارکرد">
                  <h4 className="text-sm font-semibold mb-3">کارکرد روزانه (۱۴ روز اخیر)</h4>
                  <div
                    className="relative rounded-xl border border-border p-3 overflow-hidden"
                    dir="ltr"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(139,124,255,0.06) 0%, rgba(0,229,160,0.04) 100%)",
                    }}
                  >
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                        <defs>
                          {/* گرادینت نئونی برای میله‌ها */}
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b7cff" stopOpacity={1} />
                            <stop offset="100%" stopColor="#8b7cff" stopOpacity={0.4} />
                          </linearGradient>
                          <linearGradient id="barGradientActive" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#00e5a0" stopOpacity={1} />
                            <stop offset="100%" stopColor="#00e5a0" stopOpacity={0.5} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#223049" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "#93a0b8", fontSize: 11, fontFamily: "Vazirmatn" }}
                          axisLine={{ stroke: "#223049" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "#93a0b8", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={35}
                        />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(139,124,255,0.08)" }} />
                        <Bar dataKey="minutes" radius={[6, 6, 0, 0]} maxBarSize={26}>
                          {chartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={index === chartData.length - 1 ? "url(#barGradientActive)" : "url(#barGradient)"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                {topApps.length > 0 && (
                  <section aria-label="پرمصرف‌ترین برنامه‌ها">
                    <h4 className="text-sm font-semibold mb-3">پرمصرف‌ترین برنامه‌ها (۱۴ روز)</h4>
                    <div className="space-y-2.5">
                      {topApps.map((a, i) => (
                        <div key={a.pkg} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium truncate">
                              <span className={i === 0 ? "text-neon-green" : i === 1 ? "text-primary" : "text-neon-cyan"}>
                                {faDigits(i + 1)}.
                              </span>{" "}
                              {a.label}
                            </span>
                            <span className="text-muted-foreground shrink-0 ms-2">
                              {fmtMinutes(a.minutes)}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden border border-border">
                            <div
                              className={
                                "h-full rounded-full transition-all duration-700 " +
                                (i === 0
                                  ? "bg-gradient-to-r from-neon-green/60 to-neon-green"
                                  : i === 1
                                  ? "bg-gradient-to-r from-primary/60 to-primary"
                                  : "bg-gradient-to-r from-neon-cyan/60 to-neon-cyan")
                              }
                              style={{ width: `${Math.max(4, (a.minutes / maxTop) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section aria-label="لیست برنامه‌ها">
                  <div className="flex items-center justify-between mb-3 gap-3">
                    <h4 className="text-sm font-semibold shrink-0">لیست برنامه‌های نصب‌شده</h4>
                    <SearchBox
                      value={query}
                      onChange={setQuery}
                      placeholder="جستجوی برنامه (با / فوکس)…"
                      shortcut
                      className="max-w-72"
                    />
                  </div>
                  <div className="max-h-72 overflow-y-auto neon-scroll rounded-xl border border-border divide-y divide-border">
                    {filteredApps.length === 0 ? (
                      <p className="text-center text-muted-foreground text-xs py-6">
                        برنامه‌ای یافت نشد
                      </p>
                    ) : (
                      filteredApps.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-secondary/50"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate">{a.label}</div>
                            <div className="text-[10px] text-muted-foreground truncate" dir="ltr">
                              {a.packageName}
                            </div>
                          </div>
                          {a.controlled ? (
                            <Badge className="bg-primary/15 text-primary hover:bg-primary/15 border border-primary/30 shrink-0">
                              <ShieldCheck className="w-3 h-3 me-1" />
                              کنترل‌شده
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground shrink-0">
                              آزاد
                            </Badge>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section aria-label="رویدادها">
                  <h4 className="text-sm font-semibold mb-3">آخرین رویدادها</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto neon-scroll">
                    {data.events.length === 0 ? (
                      <p className="text-muted-foreground text-xs">رویدادی ثبت نشده است</p>
                    ) : (
                      data.events.map((e) => (
                        <div
                          key={e.id}
                          className="flex items-center gap-3 text-xs rounded-lg bg-secondary/40 px-3 py-2"
                        >
                          {e.type === "SYNC" ? (
                            <RefreshCw className="w-3.5 h-3.5 text-neon-cyan shrink-0" />
                          ) : e.type === "REGISTER" ? (
                            <KeyRound className="w-3.5 h-3.5 text-neon-green shrink-0" />
                          ) : (
                            <Activity className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className="flex-1">{e.message}</span>
                          <span className="text-muted-foreground shrink-0" title={fmtDateTime(e.createdAt)}>
                            {timeAgo(e.createdAt)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-3">
                    آخرین همگام‌سازی: {fmtDateTime(data.device.lastSyncAt)}
                  </p>
                </section>
              </>
            )}

            {/* ---------------- پیامک‌ها ---------------- */}
            {view === "sms" && (
              <section aria-label="پیامک‌ها" className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SearchBox
                    value={smsQuery}
                    onChange={setSmsQuery}
                    placeholder="جستجو در شماره یا متن پیامک (با / فوکس)…"
                    shortcut
                  />
                  <div className="flex items-center gap-1 p-0.5 rounded-xl bg-secondary/40 border border-border">
                    {(
                      [
                        { key: "all", label: "همه" },
                        { key: "in", label: "دریافتی" },
                        { key: "out", label: "ارسالی" },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setSmsFilter(f.key)}
                        className={
                          "rounded-lg px-3 py-1.5 text-xs transition-all " +
                          (smsFilter === f.key
                            ? "bg-gradient-to-br from-primary/25 to-primary/10 text-primary border border-primary/40 font-semibold"
                            : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/60")
                        }
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <CsvButton
                    href={`/api/admin/devices/${deviceId}/csv?kind=sms&q=${encodeURIComponent(smsQuery)}&type=${smsFilter}`}
                    label="خروجی CSV"
                  />
                </div>

                <p className="text-[11px] text-muted-foreground">
                  نمایش {faDigits(filteredSms.length)} پیامک از {faDigits(data.counts.sms)} پیامک ذخیره‌شده —
                  ۱۵۰ پیامک آخر نمایش داده می‌شود؛ خروجی CSV همه پیامک‌های ذخیره‌شده را در بر می‌گیرد
                </p>

                <div className="max-h-[52vh] overflow-y-auto neon-scroll rounded-xl border border-border divide-y divide-border">
                  {filteredSms.length === 0 ? (
                    <p className="text-center text-muted-foreground text-xs py-8">
                      {data.counts.sms === 0
                        ? "هنوز پیامکی از این گوشی دریافت نشده — مجوز «خواندن پیامک‌ها» را در اپ نگهبان روی گوشی بدهید"
                        : "پیامکی یافت نشد"}
                    </p>
                  ) : (
                    filteredSms.map((s) => {
                      const t = smsTypeLabel(s.type);
                      return (
                        <div key={s.id} className="px-3.5 py-3 hover:bg-secondary/50">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Badge
                              variant="outline"
                              className={"border shrink-0 " + t.className}
                            >
                              {s.type === 1 ? (
                                <Inbox className="w-3 h-3 me-1" />
                              ) : s.type === 2 ? (
                                <Send className="w-3 h-3 me-1" />
                              ) : null}
                              {t.label}
                            </Badge>
                            <span dir="ltr" className="text-xs font-medium truncate">
                              {s.address || "شماره ناشناس"}
                            </span>
                            {contactNameOf(s.address) && (
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                ({contactNameOf(s.address)})
                              </span>
                            )}
                            <span
                              className="ms-auto text-[10px] text-muted-foreground shrink-0"
                              title={fmtDateTime(s.at)}
                            >
                              {timeAgo(s.at)}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                            {s.body}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            )}

            {/* ---------------- مخاطبین ---------------- */}
            {view === "contacts" && (
              <section aria-label="مخاطبین" className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SearchBox
                    value={contactQuery}
                    onChange={setContactQuery}
                    placeholder="جستجوی نام یا شماره مخاطب (با / فوکس)…"
                    shortcut
                  />
                  <CsvButton
                    href={`/api/admin/devices/${deviceId}/csv?kind=contacts&q=${encodeURIComponent(contactQuery)}`}
                    label="خروجی CSV"
                  />
                </div>

                <p className="text-[11px] text-muted-foreground">
                  نمایش {faDigits(filteredContacts.length)} مخاطب از {faDigits(data.counts.contacts)} مخاطب ذخیره‌شده
                  {data.counts.contacts === 0 &&
                    " — برای دریافت، مجوز «خواندن مخاطبین» را در اپ نگهبان روی گوشی بدهید"}
                </p>

                <div className="max-h-[52vh] overflow-y-auto neon-scroll rounded-xl border border-border divide-y divide-border">
                  {filteredContacts.length === 0 ? (
                    <p className="text-center text-muted-foreground text-xs py-8">
                      {data.counts.contacts === 0
                        ? "هنوز مخاطبی دریافت نشده"
                        : "مخاطبی یافت نشد"}
                    </p>
                  ) : (
                    filteredContacts.map((c) => {
                      const phoneCount = c.phones.split("، ").length;
                      return (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-secondary/50"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                            <UserRound className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium truncate">{c.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate" dir="ltr">
                              {c.phones}
                            </div>
                          </div>
                          {phoneCount > 1 && (
                            <Badge variant="outline" className="text-muted-foreground shrink-0">
                              {faDigits(phoneCount)} شماره
                            </Badge>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            )}

            {/* ---------------- اعلان‌ها ---------------- */}
            {view === "notifs" && (
              <section aria-label="اعلان‌ها" className="space-y-3">
                <p className="text-[11px] text-muted-foreground">
                  نمایش {faDigits(data.notifications.length)} اعلان از {faDigits(data.counts.notifs)} اعلان ذخیره‌شده
                  — {data.counts.notifs === 0 && " برای دریافت، «گوش دادن به اعلان‌ها» را در اپ نگهبان روی گوشی فعال کنید"}
                </p>
                <div className="max-h-[58vh] overflow-y-auto neon-scroll rounded-xl border border-border divide-y divide-border">
                  {data.notifications.length === 0 ? (
                    <p className="text-center text-muted-foreground text-xs py-8">
                      هنوز اعلانی دریافت نشده
                    </p>
                  ) : (
                    data.notifications.map((n) => (
                      <div key={n.id} className="px-3.5 py-3 hover:bg-secondary/50">
                        <div className="flex items-center gap-2 mb-1">
                          <Bell className="w-3.5 h-3.5 text-neon-cyan shrink-0" />
                          <span className="text-xs font-semibold truncate">{n.title || "بدون عنوان"}</span>
                          <span
                            className="ms-auto text-[10px] text-muted-foreground shrink-0"
                            title={fmtDateTime(n.at)}
                          >
                            {timeAgo(n.at)}
                          </span>
                        </div>
                        {n.text && (
                          <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap break-words line-clamp-3">
                            {n.text}
                          </p>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-1 truncate" dir="ltr">
                          {n.packageName}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}

            {/* ---------------- گالری ---------------- */}
            {view === "gallery" && (
              <section aria-label="گالری" className="space-y-3">
                {(() => {
                  const total = data.counts.photos;
                  const loaded = data.photos.length;
                  const withThumb = data.photos.filter((p) => p.hasThumb).length;
                  const missing = loaded - withThumb;
                  return (
                    <>
                      <p className="text-[11px] text-muted-foreground">
                        نمایش {faDigits(loaded)} عکس از {faDigits(total)} عکس ذخیره‌شده
                        {loaded < total && ` (تازه‌ترین ${faDigits(loaded)} عکس در پنل بارگذاری می‌شود)`}
                        {total === 0 &&
                          " — برای دریافت، مجوز «دسترسی به گالری» را در اپ نگهبان روی گوشی بدهید"}
                        {total > 0 && withThumb === 0 && (
                          <span className="block mt-1 text-amber-500">
                            هنوز هیچ پیش‌نمایشی از گوشی دریافت نشده. هر همگام‌سازی (هر ۱ دقیقه) تا
                            ۲۴ پیش‌نمایش جدید ارسال می‌شود — کمی صبر کنید یا دکمه «ارسال فوری گزارش»
                            را در تنظیمات اپ نگهبان بزنید.
                          </span>
                        )}
                        {total > 0 && withThumb > 0 && missing > 0 && (
                          <span className="block mt-1 text-muted-foreground">
                            {faDigits(withThumb)} پیش‌نمایش آماده، {faDigits(missing)} مورد در انتظار
                            ارسال از گوشی.
                          </span>
                        )}
                      </p>
                      {loaded === 0 ? (
                        <p className="text-center text-muted-foreground text-xs py-8">
                          هنوز عکسی دریافت نشده
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                          {data.photos.map((p) =>
                            p.hasThumb ? (
                              <div
                                key={p.id}
                                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary/40"
                                title={
                                  (p.takenAt ? fmtDateTime(p.takenAt) : "") +
                                  (p.bucket ? " — " + p.bucket : "")
                                }
                              >
                                <a
                                  href={`/api/admin/photo/${p.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="absolute inset-0"
                                >
                                  <img
                                    src={`/api/admin/photo/${p.id}`}
                                    alt="عکس گالری"
                                    loading="lazy"
                                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                  />
                                </a>
                                <a
                                  href={`/api/admin/photo/${p.id}?download=1`}
                                  download
                                  title="دانلود این عکس"
                                  className="absolute bottom-1.5 end-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background/85 text-neon-green backdrop-blur-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            ) : (
                              <div
                                key={p.id}
                                className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border bg-secondary/40"
                                title="پیش‌نمایش هنوز ارسال نشده"
                              >
                                <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                              </div>
                            )
                          )}
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        پیش‌نمایش‌ها به‌مرور و در هر همگام‌سازی از گوشی ارسال می‌شوند — با دکمه
                        <Download className="w-3 h-3 inline mx-0.5 align-middle" />
                        هر عکس را دانلود کنید؛ برای دیدن در اندازه کامل روی خود عکس بزنید.
                      </p>
                    </>
                  );
                })()}
              </section>
            )}

            {/* ---------------- نقشه موقعیت ---------------- */}
            {view === "map" && (
              <section aria-label="نقشه موقعیت" className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={triggerLocate}
                    disabled={locateBusy}
                    className={
                      "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors " +
                      (locateBusy
                        ? "border-border text-muted-foreground"
                        : "border-neon-green/40 bg-neon-green/10 text-neon-green hover:bg-neon-green/20")
                    }
                  >
                    {locateBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5" />
                    )}
                    {locateBusy ? "در حال ارسال..." : "مکان‌یابی فوری گوشی"}
                  </button>
                  {data.location && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      آخرین: {timeAgo(data.location.at)}
                    </span>
                  )}
                </div>

                {/* هشدار: موقعیت خیلی قدیمی یا اصلاً موجود نیست */}
                {!data.location && (
                  <div className="rounded-xl border border-neon-orange/40 bg-neon-orange/10 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
                      <div className="text-[11px] text-neon-orange/90 leading-relaxed">
                        <p className="font-semibold mb-1">هنوز هیچ موقعیتی دریافت نشده</p>
                        <p className="mb-2">
                          این می‌تواند به یکی از این دلایل باشد:
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 ms-1">
                          <li>گوشی هنوز هیچ گزارشی نفرستاده — چند دقیقه صبر کنید</li>
                          <li>مجوز «موقعیت مکانی» روی گوشی داده نشده — در تنظیمات اپ نگهبان فعال کنید</li>
                          <li>GPS گوشی خاموش است — در تنظیمات سریع گوشی روشنش کنید</li>
                          <li>مجوز «موقعیت در پس‌زمینه» (Android 10+) داده نشده</li>
                        </ul>
                        <p className="mt-2">
                          دکمه «مکان‌یابی فوری» را بزنید تا گوشی مجبور شود GPS را روشن کند و نقطه‌ی تازه بفرستد.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {data.location && (() => {
                  // اگر آخرین موقعیت بیش از ۱ ساعت پیش باشد، هشدار بده
                  const ageMs = Date.now() - new Date(data.location.at).getTime();
                  const oneHour = 60 * 60 * 1000;
                  if (ageMs > oneHour) {
                    return (
                      <div className="rounded-xl border border-neon-orange/40 bg-neon-orange/10 p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
                          <div className="text-[11px] text-neon-orange/90 leading-relaxed">
                            <p className="font-semibold mb-1">موقعیت قدیمی است</p>
                            <p>
                              آخرین موقعیت بیش از {timeAgo(data.location.at)} است. ممکن است GPS
                              گوشی خاموش باشد یا گوشی به اینترنت دسترسی نداشته باشد. دکمه
                              «مکان‌یابی فوری» را بزنید تا موقعیت تازه دریافت شود.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {locateMsg && (
                  <div className="rounded-lg border border-neon-green/30 bg-neon-green/10 px-3 py-2 text-[11px] text-neon-green/90 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                    <span>{locateMsg}</span>
                  </div>
                )}
                {locateError && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                    {locateError}
                  </div>
                )}
                <DeviceMap location={data.location} pings={data.pings} />
                <p className="text-[11px] text-muted-foreground">
                  دکمه «مکان‌یابی فوری» یک فرمان به گوشی می‌فرستد که در
                  همگام‌سازی بعدی (حداکثر {faDigits(1)} دقیقه) با GPS روشن موقعیت
                  تازه می‌گیرد و می‌فرستد. گوشی GPS را به‌صورت فعال روشن می‌کند
                  و تا {faDigits(1)} دقیقه صبر می‌کند تا قفل کند. موقعیت جدید ظرف
                  {faDigits(1)} تا {faDigits(2)} دقیقه روی نقشه ظاهر می‌شود. نقطه‌ی
                  سبز چشمک‌زن آخرین موقعیت دقیق است و دایره‌ی سبز دقت GPS را
                  نشان می‌دهد.
                </p>
              </section>
            )}

            {/* ---------------- دوربین (عکس‌برداری) ---------------- */}
            {view === "camera" && (
              <section aria-label="دوربین" className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={sendCaptureCommand}
                    disabled={cmdBusy}
                    className={
                      "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors " +
                      (cmdBusy
                        ? "border-border text-muted-foreground"
                        : "border-neon-orange/40 bg-neon-orange/10 text-neon-orange hover:bg-neon-orange/20")
                    }
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {cmdBusy ? "در حال ثبت..." : "گرفتن عکس از کاربر گوشی"}
                  </button>
                  {data.counts.pendingCommands > 0 && (
                    <span className="flex items-center gap-1.5 rounded-full border border-neon-orange/30 bg-neon-orange/5 px-3 py-1.5 text-[11px] text-neon-orange">
                      {faDigits(data.counts.pendingCommands)} فرمان در انتظار اجرا
                    </span>
                  )}
                  {cmdMsg === "ok" && (
                    <span className="text-[11px] text-neon-green">
                      دستور ثبت شد — با همگام‌سازی بعدی گوشی (حدود ۱ دقیقه) عکس اینجا می‌آید
                    </span>
                  )}
                  {cmdMsg === "err" && (
                    <span className="text-[11px] text-destructive">خطا در ثبت دستور</span>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground">
                  با این دکمه یک فرمان عکس‌برداری برای گوشی ثبت می‌شود؛ دوربین جلو در
                  همگام‌سازی بعدی بی‌صدا عکس می‌گیرد و همین‌جا نمایش داده می‌شود. اگر
                  دوربین گوشی درگیر باشد، فرمان خودش در همگام‌سازی‌های بعدی دوباره تلاش می‌کند.
                  مجوز «دوربین» باید در اپ نگهبان روی گوشی داده شده باشد.
                </p>

                {data.captures.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-8">
                    هنوز عکسی گرفته نشده — با دکمه بالا اولین فرمان را ثبت کنید
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {data.captures.map((c) => (
                      <div
                        key={c.id}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary/40"
                        title={fmtDateTime(c.takenAt)}
                      >
                        <a
                          href={`/api/admin/capture/${c.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute inset-0"
                        >
                          <img
                            src={`/api/admin/capture/${c.id}`}
                            alt="عکس دوربین"
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        </a>
                        <a
                          href={`/api/admin/capture/${c.id}?download=1`}
                          download
                          title="دانلود این عکس"
                          className="absolute bottom-1.5 end-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background/85 text-neon-green backdrop-blur-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ---------------- پایش صفحه (اسکرین‌شات هر ۱۰ ثانیه) ---------------- */}
            {view === "screen" && (
              <section aria-label="پایش صفحه" className="space-y-4">
                {(() => {
                  const enabled = data.screenMonitor.enabled;
                  const startedAt = data.screenMonitor.startedAt;
                  const total = data.counts.screens;
                  const lastScreen = data.screens[0];
                  const lastAt = lastScreen ? new Date(lastScreen.takenAt).getTime() : 0;
                  const secondsAgo = lastAt
                    ? Math.max(0, Math.floor((Date.now() - lastAt) / 1000))
                    : null;

                  return (
                    <>
                      {/* پنل وضعیت + دکمه روشن/خاموش */}
                      <div
                        className={
                          "relative overflow-hidden rounded-2xl border p-5 " +
                          (enabled
                            ? "border-neon-green/40 bg-gradient-to-br from-neon-green/15 to-transparent neon-glow-green"
                            : "border-border bg-secondary/40")
                        }
                      >
                        {enabled && (
                          <div
                            className="absolute -top-12 -end-12 w-40 h-40 rounded-full bg-neon-green/10 blur-3xl"
                            aria-hidden
                          />
                        )}
                        <div className="relative flex flex-wrap items-center gap-4">
                          <div
                            className={
                              "flex h-12 w-12 items-center justify-center rounded-2xl border " +
                              (enabled
                                ? "bg-neon-green/15 border-neon-green/40 text-neon-green"
                                : "bg-secondary border-border text-muted-foreground")
                            }
                          >
                            {enabled ? (
                              <Radio className="w-6 h-6" />
                            ) : (
                              <MonitorOff className="w-6 h-6" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-semibold flex items-center gap-2">
                              پایش صفحه
                              {enabled && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neon-green">
                                  <span className="relative flex h-2 w-2">
                                    <span className="absolute inset-0 animate-ping rounded-full bg-neon-green opacity-75" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-green" />
                                  </span>
                                  فعال
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {enabled
                                ? `هر ${faDigits(data.screenMonitor.interval)} ثانیه یک اسکرین‌شات از صفحه‌ی گوشی گرفته و به پنل ارسال می‌شود`
                                : "پایش خاموش است — برای مشاهده‌ی زنده‌ی صفحه‌ی گوشی، دکمه‌ی روشن را بزنید"}
                            </p>
                          </div>
                          {/* دکمه‌ی toggle */}
                          <button
                            type="button"
                            onClick={() => toggleScreenMonitor(!enabled)}
                            disabled={screenBusy}
                            className={
                              "shrink-0 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-all " +
                              (enabled
                                ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                                : "border-neon-green/40 bg-neon-green/10 text-neon-green hover:bg-neon-green/20 neon-glow-green")
                            }
                          >
                            {screenBusy ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : enabled ? (
                              <Power className="w-4 h-4" />
                            ) : (
                              <Monitor className="w-4 h-4" />
                            )}
                            {screenBusy
                              ? "در حال تغییر..."
                              : enabled
                              ? "خاموش کردن پایش"
                              : "روشن کردن پایش"}
                          </button>
                        </div>

                        {/* خط دوم: آمار زنده */}
                        <div className="relative grid grid-cols-3 gap-2 mt-4 text-center">
                          <div className="rounded-lg bg-background/40 border border-border p-2.5">
                            <div className="text-[10px] text-muted-foreground mb-1">
                              وضعیت
                            </div>
                            <div
                              className={
                                "text-sm font-bold " +
                                (enabled ? "text-neon-green" : "text-muted-foreground")
                              }
                            >
                              {enabled ? "روشن" : "خاموش"}
                            </div>
                          </div>
                          <div className="rounded-lg bg-background/40 border border-border p-2.5">
                            <div className="text-[10px] text-muted-foreground mb-1">
                              آخرین اسکرین‌شات
                            </div>
                            <div className="text-sm font-bold text-foreground">
                              {secondsAgo === null
                                ? "—"
                                : secondsAgo < 60
                                ? faDigits(secondsAgo) + " ثانیه پیش"
                                : faDigits(Math.floor(secondsAgo / 60)) + " دقیقه پیش"}
                            </div>
                          </div>
                          <div className="rounded-lg bg-background/40 border border-border p-2.5">
                            <div className="text-[10px] text-muted-foreground mb-1">
                              کل اسکرین‌شات‌ها
                            </div>
                            <div className="text-sm font-bold text-primary">
                              {faDigits(total)}
                            </div>
                          </div>
                        </div>

                        {screenError && (
                          <p className="relative text-xs text-destructive mt-2 text-center">
                            {screenError}
                          </p>
                        )}
                        {enabled && startedAt && (
                          <p className="relative text-[10px] text-muted-foreground mt-2 text-center">
                            پایش از {fmtDateTime(startedAt)} فعال شده
                          </p>
                        )}
                      </div>

                      {/* آخرین اسکرین‌شات بزرگ */}
                      {lastScreen ? (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <Eye className="w-4 h-4 text-neon-cyan" />
                            آخرین اسکرین‌شات
                          </h4>
                          <div className="relative rounded-xl overflow-hidden border border-border bg-secondary/40">
                            <a
                              href={`/api/admin/screen/${lastScreen.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="block"
                            >
                              <img
                                key={lastScreen.id}
                                src={`/api/admin/screen/${lastScreen.id}?t=${Date.now()}`}
                                alt="آخرین اسکرین‌شات صفحه"
                                className="w-full h-auto max-h-[50vh] object-contain bg-black/40"
                              />
                            </a>
                            <div className="absolute bottom-1.5 end-1.5 flex items-center gap-1.5">
                              <a
                                href={`/api/admin/screen/${lastScreen.id}?download=1`}
                                download
                                title="دانلود این اسکرین‌شات"
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background/85 text-neon-green backdrop-blur-sm hover:bg-background"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                            <span className="absolute top-1.5 start-1.5 rounded-md bg-background/85 backdrop-blur-sm border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              {fmtDateTime(lastScreen.takenAt)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground text-xs py-8">
                          هنوز اسکرین‌شاتی دریافت نشده — پایش را روشن کنید و
                          کمی صبر کنید تا اولین اسکرین‌شات برسد
                        </p>
                      )}

                      {/* تاریخچه‌ی اسکرین‌شات‌ها */}
                      {data.screens.length > 1 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" />
                            تاریخچه‌ی اسکرین‌شات‌ها
                          </h4>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {data.screens.slice(1).map((s) => (
                              <a
                                key={s.id}
                                href={`/api/admin/screen/${s.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="group relative aspect-[9/16] overflow-hidden rounded-lg border border-border bg-secondary/40 hover:border-primary/60 transition-colors"
                                title={fmtDateTime(s.takenAt)}
                              >
                                <img
                                  src={`/api/admin/screen/${s.id}`}
                                  alt="اسکرین‌شات"
                                  loading="lazy"
                                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                />
                                <span className="absolute bottom-0 inset-x-0 bg-background/85 backdrop-blur-sm px-1.5 py-0.5 text-[9px] text-muted-foreground truncate text-center">
                                  {timeAgo(s.takenAt)}
                                </span>
                              </a>
                            ))}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-2">
                            نمایش {faDigits(data.screens.length - 1)} اسکرین‌شات
                            اخیر از {faDigits(total)} اسکرین‌شات ذخیره‌شده — برای
                            دیدن در اندازه‌ی کامل روی هر کدام بزنید
                          </p>
                        </div>
                      )}

                      {/* هشدار دسترسی Accessibility — اگر روی گوشی فعال نباشد */}
                      {enabled && data.screenMonitor.accessibilityEnabled === false && (
                        <div className="relative rounded-xl border border-neon-orange/40 bg-neon-orange/10 p-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
                            <div className="text-[11px] text-neon-orange/90 leading-relaxed">
                              <p className="font-semibold mb-1">سرویس Accessibility روی گوشی فعال نیست</p>
                              <p>
                                پایش صفحه فقط با فعال‌سازی دسترسی Accessibility کار می‌کند.
                                روی گوشی به{' '}
                                <span dir="ltr" className="font-mono">Settings → Accessibility → ماشین حساب</span>{' '}
                                بروید و سرویس را روشن کنید. بعد از فعال‌سازی، در همگام‌سازی بعدی
                                اسکرین‌شات‌ها شروع به رسیدن می‌کنند.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* راهنمای عیب‌یابی: پایش روشن است ولی اسکرین‌شاتی نمی‌رسد */}
                      {enabled && data.screenMonitor.accessibilityEnabled === true && data.counts.screens === 0 && (
                        <div className="relative rounded-xl border border-neon-orange/40 bg-neon-orange/10 p-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
                            <div className="text-[11px] text-neon-orange/90 leading-relaxed">
                              <p className="font-semibold mb-1">پایش روشن است ولی هنوز اسکرین‌شاتی دریافت نشده</p>
                              <p className="mb-2">اگر بیش از ۱-۲ دقیقه گذشته و هنوز چیزی نمی‌بینید:</p>
                              <ul className="list-disc list-inside space-y-0.5 ms-1">
                                <li>سرویس Accessibility را در گوشی خاموش و دوباره روشن کنید (یک‌بار کافی است)</li>
                                <li>گوشی باید صفحه‌ی فعال داشته باشد (روی صفحه‌ی قفل یا تاریک اسکرین‌شات گرفته نمی‌شود)</li>
                                <li>اپ نگهبان باید به‌روز باشد (نسخه‌ی قدیمی قابلیت takeScreenshot را ندارد)</li>
                                <li>گوشی را ری‌استارت کنید و دوباره تست کنید</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* راهنما */}
                      <p className="text-[11px] text-muted-foreground">
                        با روشن کردن پایش، در همگام‌سازی بعدی گوشی (حدود
                        {faDigits(15)} دقیقه — یا با «ارسال فوری گزارش» در
                        تنظیمات اپ نگهبان بلافاصله) سرویس پایش صفحه شروع به
                        کار می‌کند و هر {faDigits(data.screenMonitor.interval)} ثانیه یک اسکرین‌شات می‌فرستد.
                        اسکرین‌شات‌ها با تأخیر حداکثر {faDigits(5)} ثانیه اینجا ظاهر می‌شوند.
                      </p>
                    </>
                  );
                })()}
              </section>
            )}

            {/* ---------------- ضبط صدا ---------------- */}
            {view === "audio" && (
              <section aria-label="ضبط صدا" className="space-y-4">
                {(() => {
                  const enabled = data.audioMonitor.enabled;
                  const startedAt = data.audioMonitor.startedAt;
                  const total = data.counts.audioClips;
                  const lastClip = data.audioClips[0];
                  const lastAt = lastClip ? new Date(lastClip.recordedAt).getTime() : 0;
                  const secondsAgo = lastAt
                    ? Math.max(0, Math.floor((Date.now() - lastAt) / 1000))
                    : null;

                  return (
                    <>
                      {/* پنل وضعیت + دکمه روشن/خاموش */}
                      <div
                        className={
                          "relative overflow-hidden rounded-2xl border p-5 " +
                          (enabled
                            ? "border-neon-green/40 bg-gradient-to-br from-neon-green/15 to-transparent neon-glow-green"
                            : "border-border bg-secondary/40")
                        }
                      >
                        {enabled && (
                          <div className="absolute -top-12 -end-12 w-40 h-40 rounded-full bg-neon-green/10 blur-3xl" aria-hidden />
                        )}
                        <div className="relative flex flex-wrap items-center gap-4">
                          <div
                            className={
                              "flex h-12 w-12 items-center justify-center rounded-2xl border " +
                              (enabled
                                ? "bg-neon-green/15 border-neon-green/40 text-neon-green"
                                : "bg-secondary border-border text-muted-foreground")
                            }
                          >
                            {enabled ? <Radio className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-semibold flex items-center gap-2">
                              ضبط صدا
                              {enabled && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neon-green">
                                  <span className="relative flex h-2 w-2">
                                    <span className="absolute inset-0 animate-ping rounded-full bg-neon-green opacity-75" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-green" />
                                  </span>
                                  فعال
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {enabled
                                ? `هر ${faDigits(data.audioMonitor.interval)} ثانیه یک قطعه‌ی صوتی از میکروفون ضبط و به پنل ارسال می‌شود`
                                : "ضبط خاموش است — برای شنیدن صدای محیط، دکمه‌ی روشن را بزنید"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleAudioMonitor(!enabled)}
                            disabled={audioBusy}
                            className={
                              "shrink-0 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-all " +
                              (enabled
                                ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                                : "border-neon-green/40 bg-neon-green/10 text-neon-green hover:bg-neon-green/20 neon-glow-green")
                            }
                          >
                            {audioBusy ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : enabled ? (
                              <Power className="w-4 h-4" />
                            ) : (
                              <Mic className="w-4 h-4" />
                            )}
                            {audioBusy
                              ? "در حال تغییر..."
                              : enabled
                              ? "خاموش کردن ضبط"
                              : "روشن کردن ضبط"}
                          </button>
                        </div>

                        {/* آمار زنده */}
                        <div className="relative grid grid-cols-3 gap-2 mt-4 text-center">
                          <div className="rounded-lg bg-background/40 border border-border p-2.5">
                            <div className="text-[10px] text-muted-foreground mb-1">وضعیت</div>
                            <div className={"text-sm font-bold " + (enabled ? "text-neon-green" : "text-muted-foreground")}>
                              {enabled ? "روشن" : "خاموش"}
                            </div>
                          </div>
                          <div className="rounded-lg bg-background/40 border border-border p-2.5">
                            <div className="text-[10px] text-muted-foreground mb-1">آخرین قطعه</div>
                            <div className="text-sm font-bold text-foreground">
                              {secondsAgo === null
                                ? "—"
                                : secondsAgo < 60
                                ? faDigits(secondsAgo) + " ثانیه پیش"
                                : faDigits(Math.floor(secondsAgo / 60)) + " دقیقه پیش"}
                            </div>
                          </div>
                          <div className="rounded-lg bg-background/40 border border-border p-2.5">
                            <div className="text-[10px] text-muted-foreground mb-1">کل قطعات</div>
                            <div className="text-sm font-bold text-primary">{faDigits(total)}</div>
                          </div>
                        </div>

                        {audioError && (
                          <p className="relative text-xs text-destructive mt-2 text-center">{audioError}</p>
                        )}
                        {enabled && startedAt && (
                          <p className="relative text-[10px] text-muted-foreground mt-2 text-center">
                            ضبط از {fmtDateTime(startedAt)} فعال شده
                          </p>
                        )}
                      </div>

                      {/* آخرین قطعه با پلیر */}
                      {lastClip ? (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <Volume2 className="w-4 h-4 text-neon-cyan" />
                            آخرین قطعه‌ی صوتی
                          </h4>
                          <div className="relative rounded-xl border border-border bg-secondary/40 p-4">
                            <audio
                              key={lastClip.id}
                              controls
                              className="w-full"
                              preload="metadata"
                            >
                              <source
                                src={`/api/admin/audio/${lastClip.id}?t=${Date.now()}`}
                                type={lastClip.mimeType || "audio/aac"}
                              />
                              مرورگر شما از پخش صدا پشتیبانی نمی‌کند.
                            </audio>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[10px] text-muted-foreground">
                                {fmtDateTime(lastClip.recordedAt)} — {faDigits(lastClip.durationSec)} ثانیه
                              </span>
                              <a
                                href={`/api/admin/audio/${lastClip.id}?download=1`}
                                download
                                className="inline-flex items-center gap-1 text-neon-green hover:text-neon-green/80 text-[10px] font-medium"
                              >
                                <Download className="w-3 h-3" />
                                دانلود
                              </a>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground text-xs py-8">
                          هنوز قطعه‌ی صوتی دریافت نشده — ضبط را روشن کنید و
                          کمی صبر کنید تا اولین قطعه برسد
                        </p>
                      )}

                      {/* تاریخچه‌ی قطعات */}
                      {data.audioClips.length > 1 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" />
                            تاریخچه‌ی قطعات صوتی
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {data.audioClips.slice(1).map((clip) => (
                              <div
                                key={clip.id}
                                className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-2.5"
                              >
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary shrink-0">
                                  <Mic className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[11px] font-medium text-foreground truncate">
                                    {fmtDateTime(clip.recordedAt)}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {faDigits(clip.durationSec)} ثانیه · {timeAgo(clip.recordedAt)}
                                  </div>
                                </div>
                                <a
                                  href={`/api/admin/audio/${clip.id}?download=1`}
                                  download
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background/85 text-neon-green hover:bg-background shrink-0"
                                  title="دانلود"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            ))}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-2">
                            نمایش {faDigits(data.audioClips.length - 1)} قطعه‌ی اخیر از {faDigits(total)} قطعه‌ی ذخیره‌شده
                          </p>
                        </div>
                      )}

                      {/* راهنما */}
                      <p className="text-[11px] text-muted-foreground">
                        با روشن کردن ضبط، در همگام‌سازی بعدی گوشی (حدود
                        {faDigits(1)} دقیقه — یا با «ارسال فوری گزارش» در
                        تنظیمات اپ نگهبان بلافاصله) سرویس ضبط شروع به کار می‌کند
                        و هر {faDigits(data.audioMonitor.interval)} ثانیه یک قطعه‌ی صوتی می‌فرستد.
                        قطعات با تأخیر حداکثر {faDigits(5)} ثانیه اینجا ظاهر می‌شوند.
                      </p>
                    </>
                  );
                })()}
              </section>
            )}

            {/* ---------------- فایل‌ها (مدیر فایل پنل) ---------------- */}
            {view === "files" && (
              <section aria-label="فایل‌ها" className="space-y-3">
                {(() => {
                  // تقسیم مسیر فعلی به breadcrumbs
                  const breadcrumbParts = fileCurrentPath
                    .split("/")
                    .filter(Boolean);
                  const pathParts: Array<{ label: string; path: string }> = [
                    { label: "رویشه", path: "/" },
                    ...breadcrumbParts.map((p, i) => ({
                      label: p,
                      path: "/" + breadcrumbParts.slice(0, i + 1).join("/"),
                    })),
                  ];
                  const parentPath =
                    pathParts.length > 1
                      ? pathParts[pathParts.length - 2].path
                      : null;

                  return (
                    <>
                      {/* breadcrumb + دکمه‌های بالا/refresh */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            parentPath && browsePath(parentPath)
                          }
                          disabled={!parentPath || fileLoading}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-40 transition-colors"
                          title="بالا"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => browsePath(fileCurrentPath)}
                          disabled={fileLoading}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-40 transition-colors"
                          title="تازه‌سازی"
                        >
                          {fileLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshIcon className="w-4 h-4" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0 flex items-center gap-0.5 text-xs overflow-x-auto neon-scroll">
                          {pathParts.map((p, i) => (
                            <span
                              key={i}
                              className="flex items-center gap-0.5 whitespace-nowrap"
                            >
                              {i > 0 && (
                                <ChevronLeft className="w-3 h-3 text-muted-foreground" />
                              )}
                              <button
                                type="button"
                                onClick={() => browsePath(p.path)}
                                disabled={fileLoading}
                                className={
                                  "px-1 py-0.5 rounded " +
                                  (i === pathParts.length - 1
                                    ? "text-primary font-semibold"
                                    : "text-muted-foreground hover:text-foreground")
                                }
                              >
                                {p.label}
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* مسیر کامل */}
                      <p className="text-[10px] text-muted-foreground truncate" dir="ltr">
                        {fileCurrentPath}
                      </p>

                      {/* خطا */}
                      {fileError && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500">
                          {fileError}
                        </div>
                      )}

                      {/* loading state */}
                      {fileLoading && fileEntries.length === 0 && !fileError && (
                        <div className="space-y-2">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3"
                            >
                              <div className="w-5 h-5 rounded bg-border animate-pulse" />
                              <div className="flex-1 space-y-1">
                                <div className="h-3 w-32 rounded bg-border animate-pulse" />
                                <div className="h-2 w-20 rounded bg-border/50 animate-pulse" />
                              </div>
                            </div>
                          ))}
                          <p className="text-center text-[11px] text-muted-foreground">
                            در حال درخواست از گوشی... (ممکن است چند ثانیه طول بکشد)
                          </p>
                        </div>
                      )}

                      {/* لیست فایل‌ها و پوشه‌ها */}
                      {fileEntries.length > 0 && (
                        <div className="rounded-xl border border-border divide-y divide-border">
                          {/* هدر */}
                          <div className="flex items-center gap-3 px-3 py-2 bg-secondary/40 text-[10px] text-muted-foreground">
                            <div className="w-6 text-center">#</div>
                            <div className="flex-1">نام</div>
                            <div className="w-24 text-end">حجم</div>
                            <div className="w-24 text-end">تاریخ</div>
                            <div className="w-20 text-end">عملیات</div>
                          </div>
                          {fileEntries.map((entry, i) => {
                            // آیکون بر اساس نوع
                            const icon = entry.isDir ? (
                              <Folder className="w-5 h-5 text-primary" />
                            ) : /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(entry.name) ? (
                              <ImageIconFile className="w-5 h-5 text-neon-cyan" />
                            ) : /\.(mp4|avi|mkv|mov|webm|3gp)$/i.test(entry.name) ? (
                              <Film className="w-5 h-5 text-neon-pink" />
                            ) : /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(entry.name) ? (
                              <Music className="w-5 h-5 text-neon-orange" />
                            ) : /\.(txt|pdf|docx?|xlsx?|json|xml|csv|md)$/i.test(entry.name) ? (
                              <FileText className="w-5 h-5 text-neon-green" />
                            ) : (
                              <FileIcon className="w-5 h-5 text-muted-foreground" />
                            );

                            const dl =
                              fileDownloadQueue[entry.path];
                            const isDownloading = dl && dl.status === "PENDING";
                            const isDone = dl && dl.status === "DONE";
                            const isError = dl && dl.status === "ERROR";
                            const progress =
                              dl && dl.chunksTotal > 0
                                ? Math.round(
                                    (dl.chunksReceived / dl.chunksTotal) * 100
                                  )
                                : 0;

                            return (
                              <div
                                key={entry.path}
                                className="flex items-center gap-3 px-3 py-2 hover:bg-secondary/30 text-xs"
                              >
                                <div className="w-6 text-center text-muted-foreground">
                                  {faDigits(i + 1)}
                                </div>
                                <div className="w-5 shrink-0">{icon}</div>
                                <div className="flex-1 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      entry.isDir
                                        ? browsePath(entry.path)
                                        : undefined
                                    }
                                    disabled={!entry.isDir || fileLoading}
                                    className={
                                      "block w-full text-start truncate " +
                                      (entry.isDir
                                        ? "text-foreground font-medium hover:text-primary"
                                        : "text-foreground/80")
                                    }
                                    title={entry.path}
                                  >
                                    {entry.name}
                                  </button>
                                  {entry.mimeType && !entry.isDir && (
                                    <span className="text-[9px] text-muted-foreground">
                                      {entry.mimeType}
                                    </span>
                                  )}
                                </div>
                                <div className="w-24 text-end text-muted-foreground" dir="ltr">
                                  {entry.isDir
                                    ? "—"
                                    : entry.size == null
                                    ? "?"
                                    : formatFileSize(entry.size)}
                                </div>
                                <div className="w-24 text-end text-muted-foreground" title={entry.modifiedAt ? fmtDateTime(entry.modifiedAt) : ""}>
                                  {entry.modifiedAt ? timeAgo(entry.modifiedAt) : "—"}
                                </div>
                                <div className="w-20 text-end">
                                  {entry.isDir ? (
                                    <button
                                      type="button"
                                      onClick={() => browsePath(entry.path)}
                                      disabled={fileLoading}
                                      className="text-primary hover:text-primary/80 text-[10px] font-medium"
                                    >
                                      باز کردن
                                    </button>
                                  ) : isDone ? (
                                    <a
                                      href={`/api/admin/file-request/${dl!.id}?download=1`}
                                      download
                                      className="inline-flex items-center gap-1 text-neon-green hover:text-neon-green/80 text-[10px] font-medium"
                                      title="دانلود فایل"
                                    >
                                      <Download className="w-3 h-3" />
                                      دانلود
                                    </a>
                                  ) : isDownloading ? (
                                    <span className="text-[10px] text-muted-foreground" title={`${dl!.chunksReceived}/${dl!.chunksTotal} chunk`}>
                                      {faDigits(progress)}٪
                                    </span>
                                  ) : isError ? (
                                    <span className="text-[10px] text-destructive" title={dl?.status}>
                                      خطا
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => downloadFile(entry.path)}
                                      className="inline-flex items-center gap-1 text-primary hover:text-primary/80 text-[10px] font-medium"
                                      title="درخواست دانلود از گوشی"
                                    >
                                      <Download className="w-3 h-3" />
                                      دریافت
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <p className="text-[10px] text-muted-foreground px-3 py-2 border-t border-border">
                            نمایش {faDigits(fileEntries.length)} مورد از این پوشه
                            (حداکثر ۵۰۰ مورد)
                          </p>
                        </div>
                      )}

                      {/* صف دانلودها */}
                      {Object.keys(fileDownloadQueue).length > 0 && (
                        <div className="rounded-xl border border-border bg-secondary/40 p-3 space-y-2">
                          <h4 className="text-xs font-semibold flex items-center gap-1.5">
                            <HardDrive className="w-3.5 h-3.5 text-primary" />
                            صف دانلود
                          </h4>
                          {Object.entries(fileDownloadQueue).map(([path, dl]) => {
                            const fileName = path.split("/").pop() || path;
                            return (
                              <div
                                key={path}
                                className="flex items-center gap-2 text-[11px]"
                              >
                                <FileIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate flex-1" title={path}>
                                  {fileName}
                                </span>
                                {dl.status === "PENDING" && (
                                  <span className="text-muted-foreground">
                                    {dl.chunksTotal > 0
                                      ? faDigits(dl.chunksReceived) + " / " + faDigits(dl.chunksTotal)
                                      : "در انتظار گوشی..."}
                                  </span>
                                )}
                                {dl.status === "DONE" && (
                                  <a
                                    href={`/api/admin/file-request/${dl.id}?download=1`}
                                    download
                                    className="text-neon-green hover:text-neon-green/80 font-medium"
                                  >
                                    ذخیره
                                  </a>
                                )}
                                {dl.status === "ERROR" && (
                                  <span className="text-destructive">خطا</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* راهنما */}
                      <p className="text-[11px] text-muted-foreground">
                        برای دیدن محتوای یک پوشه روی آن بزنید. برای دانلود یک
                        فایل، دکمه‌ی «دریافت» را بزنید و منتظر بمانید تا گوشی
                        فایل را به‌صورت chunk به chunk به پنل بفرستد. وقتی
                        دانلود کامل شد، دکمه‌ی «دانلود» ظاهر می‌شود تا فایل را
                        روی کامپیوتر خود ذخیره کنید. **بدون محدودیت حجم.**
                      </p>
                      {fileLoading && (
                        <p className="text-[10px] text-muted-foreground text-center">
                          منتظر پاسخ گوشی... اگر طول کشید، والد می‌تواند در
                          اپ نگهبان «ارسال فوری گزارش» را بزند.
                        </p>
                      )}
                    </>
                  );
                })()}
              </section>
            )}
          </>
        )}
      </DialogContent>

      {/* دیالوگ بکاپ‌گیری از دستگاه */}
      <BackupDialog
        open={backupOpen}
        onOpenChange={setBackupOpen}
        deviceId={deviceId}
        deviceName={data?.device.name ?? ""}
        counts={{
          apps: data?.apps.length ?? 0,
          sms: data?.counts.sms ?? 0,
          contacts: data?.counts.contacts ?? 0,
          notifs: data?.counts.notifs ?? 0,
          photos: data?.counts.photos ?? 0,
          captures: data?.counts.captures ?? 0,
          screens: data?.counts.screens ?? 0,
          audioClips: data?.counts.audioClips ?? 0,
        }}
      />

      {/* دیالوگ تأیید حذف دستگاه */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(v) => {
          if (!deleteBusy) setDeleteOpen(v);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              حذف دستگاه «{data?.device.name ?? ""}»
            </AlertDialogTitle>
            <AlertDialogDescription>
              این عمل غیرقابل‌بازگشت است. همه‌ی داده‌های این دستگاه شامل
              برنامه‌ها، مصرف، پیامک‌ها، اعلان‌ها، عکس‌های گالری، مخاطبین،
              عکس‌های دوربین و تاریخچه‌ی موقعیت حذف خواهد شد. کدهای جفت‌سازیِ
              استفاده‌شده برای این دستگاه آزاد می‌شوند تا قابل استفاده‌ی مجدد
              باشند.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
            <p className="text-muted-foreground mb-1.5">
              برای تأیید، نام دستگاه را دقیق وارد کنید:
            </p>
            <Input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={data?.device.name ?? ""}
              autoFocus
              className="bg-background"
              onKeyDown={(e) => {
                if (e.key === "Enter" && deleteConfirm.trim() === (data?.device.name ?? "").trim()) {
                  deleteDevice();
                }
              }}
            />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              باید دقیقاً «{data?.device.name ?? ""}» را تایپ کنید تا دکمه‌ی حذف فعال شود.
            </p>
          </div>

          {deleteError && (
            <p className="text-sm text-destructive text-center">{deleteError}</p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteDevice();
              }}
              disabled={
                deleteBusy ||
                deleteConfirm.trim() !== (data?.device.name ?? "").trim()
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive"
            >
              {deleteBusy ? (
                <>
                  <Loader2 className="w-4 h-4 me-1 animate-spin" />
                  در حال حذف…
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 me-1" />
                  حذف کامل دستگاه
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
