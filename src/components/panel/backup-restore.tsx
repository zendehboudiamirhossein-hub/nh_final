"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { faDigits } from "./format";
import {
  Archive,
  DatabaseBackup,
  Upload,
  FileJson,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Download,
} from "lucide-react";

/**
 * دیالوگ بکاپ‌گیری از یک دستگاه.
 * کاربر می‌تواند انتخاب کند که آیا عکس‌های دوربین، اسکرین‌شات‌ها و قطعات
 * صوتی هم در فایل بکاپ باشند یا خیر (این موارد ممکن است حجم زیادی داشته
 * باشند). فایل به‌صورت یک JSON دانلود می‌شود.
 */
export function BackupDialog({
  open,
  onOpenChange,
  deviceId,
  deviceName,
  counts,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deviceId: string | null;
  deviceName: string;
  counts: {
    apps: number;
    sms: number;
    contacts: number;
    notifs: number;
    photos: number;
    captures: number;
    screens: number;
    audioClips: number;
  };
}) {
  const [includeMedia, setIncludeMedia] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doBackup() {
    if (!deviceId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const url = `/api/admin/devices/${deviceId}/backup?includeMedia=${includeMedia ? "1" : "0"}`;
      const res = await fetch(url);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "بکاپ‌گیری ناموفق بود");
      }
      // تبدیل به Blob و راه‌اندازی دانلود
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      let fileName = "backup.json";
      const m = /filename\*=UTF-8''([^;]+)/.exec(disposition);
      if (m && m[1]) {
        try {
          fileName = decodeURIComponent(m[1]);
        } catch {
          fileName = m[1];
        }
      } else {
        const m2 = /filename="([^"]+)"/.exec(disposition);
        if (m2 && m2[1]) fileName = m2[1];
      }
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
      // بستن دیالوگ پس از موفقیت
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطای ناشناخته");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) {
          onOpenChange(v);
          if (!v) {
            setError(null);
            setIncludeMedia(false);
          }
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-primary" />
            بکاپ‌گیری از «{deviceName}»
          </DialogTitle>
          <DialogDescription>
            یک فایل JSON شامل تمام داده‌های این دستگاه (همراه با توکن اتصال
            گوشی) دانلود می‌شود. با بازیابی این فایل در پنلی با همان آدرس،
            گوشی به‌طور خودکار به پنل جدید وصل می‌ماند.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* هشدار امنیتی درباره‌ی توکن */}
          <div className="rounded-xl border border-neon-orange/30 bg-neon-orange/5 p-3 text-[11px] text-muted-foreground leading-relaxed">
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-neon-orange shrink-0 mt-0.5" />
              <span>
                <strong className="text-neon-orange">توکن اتصال گوشی</strong> در
                فایل بکاپ ذخیره می‌شود تا بعداً گوشی بدون جفت‌سازی دوباره وصل
                بماند. این فایل را در جای امن نگه دارید — هر کس این فایل را داشته
                باشد می‌تواند به‌جای این گوشی به پنل وصل شود.
              </span>
            </p>
          </div>

          {/* خلاصه‌ی داده‌هایی که بکاپ گرفته می‌شوند */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <FileJson className="w-3.5 h-3.5" />
              داده‌های شامل در بکاپ:
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <CountRow label="برنامه‌ها" value={counts.apps} />
              <CountRow label="پیامک‌ها" value={counts.sms} />
              <CountRow label="مخاطبین" value={counts.contacts} />
              <CountRow label="اعلان‌ها" value={counts.notifs} />
              <CountRow label="عکس‌های گالری" value={counts.photos} />
              <CountRow label="عکس‌های دوربین" value={counts.captures} />
              <CountRow label="اسکرین‌شات‌ها" value={counts.screens} />
              <CountRow label="قطعات صوتی" value={counts.audioClips} />
            </div>
          </div>

          {/* گزینه‌ی شامل کردن فایل‌های مدیا */}
          <label
            htmlFor="include-media"
            className="flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-secondary/40 transition-colors"
          >
            <Switch
              id="include-media"
              checked={includeMedia}
              onCheckedChange={setIncludeMedia}
              disabled={busy}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium flex items-center gap-1.5">
                <DatabaseBackup className="w-4 h-4 text-neon-cyan" />
                شامل فایل‌های مدیا
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                اگر روشن باشد، عکس‌های دوربین، اسکرین‌شات‌ها و قطعات صوتی
                به‌صورت base64 در فایل بکاپ قرار می‌گیرند. این موارد ممکن
                است حجم فایل را به‌طور قابل‌توجهی افزایش دهند (هر اسکرین‌شات
                حدود ۳۰-۸۰ کیلوبایت).
              </p>
              {(counts.captures > 0 || counts.screens > 0 || counts.audioClips > 0) && (
                <p className="text-[10px] text-neon-orange mt-1.5">
                  توجه: این دستگاه {faDigits(counts.captures)} عکس دوربین،{" "}
                  {faDigits(counts.screens)} اسکرین‌شات و{" "}
                  {faDigits(counts.audioClips)} قطعه‌ی صوتی دارد که بدون این
                  گزینه در بکاپ قرار نمی‌گیرند.
                </p>
              )}
            </div>
          </label>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            انصراف
          </Button>
          <Button
            onClick={doBackup}
            disabled={busy || !deviceId}
            className="bg-gradient-to-l from-primary to-neon-cyan/80 hover:from-primary/90 hover:to-neon-cyan/70 gap-1.5"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                در حال بکاپ‌گیری…
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                دانلود فایل بکاپ
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-1 rounded-md bg-background/40 px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant="secondary" className="text-[10px] px-1.5 min-w-6 justify-center">
        {faDigits(value)}
      </Badge>
    </div>
  );
}

/**
 * دیالوگ بازیابی دستگاه از فایل بکاپ.
 * کاربر یک فایل JSON بکاپ را انتخاب می‌کند و یک دستگاه جدید با همان
 * داده‌ها ساخته می‌شود. نام دستگاه با پسوند «(بازیابی‌شده)» علامت‌گذاری
 * می‌شود تا از دستگاه اصلی متمایز باشد.
 */
export function RestoreDialog({
  open,
  onOpenChange,
  onRestored,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRestored?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function reset() {
    setFile(null);
    setError(null);
    setBusy(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setError(null);
  }

  function tryRestore() {
    if (!file) {
      setError("یک فایل بکاپ انتخاب کنید");
      return;
    }
    setConfirmOpen(true);
  }

  async function doRestore() {
    if (!file || busy) return;
    setConfirmOpen(false);
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("backup", file);
      const res = await fetch("/api/admin/devices/restore", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "بازیابی ناموفق بود");
      }
      // موفقیت — بستن دیالوگ و refresh لیست دستگاه‌ها
      reset();
      onOpenChange(false);
      onRestored?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطای ناشناخته");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) {
            onOpenChange(v);
            if (!v) reset();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DatabaseBackup className="w-5 h-5 text-neon-cyan" />
              بازیابی دستگاه از فایل بکاپ
            </DialogTitle>
            <DialogDescription>
              یک فایل بکاپ JSON را انتخاب کنید. یک دستگاه جدید با همان داده‌ها
              ساخته می‌شود. اگر فایل بکاپ شامل توکن گوشی باشد، گوشی به‌طور خودکار
              به این دستگاه وصل می‌ماند (در صورت یکسان بودن آدرس پنل).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* انتخابگر فایل */}
            <label
              htmlFor="restore-file"
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-secondary/30 p-6 cursor-pointer transition-colors"
            >
              <Upload className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                {file ? file.name : "فایل بکاپ را انتخاب کنید"}
              </span>
              {file && (
                <span className="text-[10px] text-muted-foreground">
                  {faDigits(Math.round(file.size / 1024))} کیلوبایت
                </span>
              )}
              <Input
                id="restore-file"
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
                disabled={busy}
              />
            </label>

            {/* اطلاعات مهم */}
            <div className="rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-[11px] text-muted-foreground leading-relaxed">
              <p className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-neon-cyan shrink-0 mt-0.5" />
                <span>
                  اگر فایل بکاپ شامل توکن گوشی باشد و آدرس پنل (URL) یکی باشد،
                  گوشی بدون نیاز به جفت‌سازی دوباره به‌طور خودکار به این دستگاه
                  وصل می‌ماند و همگام‌سازی ادامه پیدا می‌کند.
                </span>
              </p>
              <p className="flex items-start gap-1.5 mt-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-neon-cyan shrink-0 mt-0.5" />
                <span>
                  نام دستگاه با پسوند «(بازیابی‌شده)» علامت‌گذاری می‌شود تا از
                  دستگاه اصلی متمایز باشد.
                </span>
              </p>
              <p className="flex items-start gap-1.5 mt-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-neon-orange shrink-0 mt-0.5" />
                <span>
                  اگر توکن قبلاً در این پنل ثبت شده باشد (مثلاً از قبل دستگاهی
                  با همین توکن وجود دارد)، بازیابی ناموفق می‌شود. اول آن دستگاه
                  را حذف کنید.
                </span>
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              انصراف
            </Button>
            <Button
              onClick={tryRestore}
              disabled={busy || !file}
              className="bg-gradient-to-l from-neon-cyan to-primary/80 hover:from-neon-cyan/90 hover:to-primary/70 gap-1.5"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  در حال بازیابی…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  بازیابی دستگاه
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ تأیید نهایی بازیابی */}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(v) => {
          if (!busy) setConfirmOpen(v);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DatabaseBackup className="w-5 h-5 text-neon-cyan" />
              تأیید بازیابی دستگاه
            </AlertDialogTitle>
            <AlertDialogDescription>
              فایل «{file?.name}» پردازش می‌شود و یک دستگاه جدید با داده‌های
              آن ساخته می‌شود. این عملیات ممکن است بسته به حجم فایل چند
              ثانیه طول بکشد. آیا ادامه می‌دهید؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                doRestore();
              }}
              disabled={busy}
              className="bg-neon-cyan text-background hover:bg-neon-cyan/90 border-neon-cyan"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 me-1 animate-spin" />
                  در حال بازیابی…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 me-1" />
                  شروع بازیابی
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
