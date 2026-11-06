"use client";

import { useState } from "react";
import { PairingItem } from "./types";
import { faDigits, fmtDateTime, timeAgo } from "./format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  Copy,
  Check,
  KeyRound,
  Smartphone,
  Loader2,
} from "lucide-react";

function CodeStatus({ item }: { item: PairingItem }) {
  const now = Date.now();
  if (item.used) {
    return (
      <Badge className="bg-neon-green/15 text-neon-green hover:bg-neon-green/15 border border-neon-green/30">
        {item.deviceName ? `استفاده‌شده — ${item.deviceName}` : "استفاده‌شده"}
      </Badge>
    );
  }
  if (new Date(item.expiresAt).getTime() < now) {
    return <Badge variant="outline" className="text-muted-foreground">منقضی‌شده</Badge>;
  }
  return (
    <Badge className="bg-primary/15 text-primary hover:bg-primary/15 border border-primary/30">
      فعال
    </Badge>
  );
}

export function PairingView({
  codes,
  onRefresh,
}: {
  codes: PairingItem[];
  onRefresh: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  async function createCode() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || null }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setLastCode(json.code.code);
      setCopied(false);
      setNote("");
      await onRefresh();
    } catch {
      toast({ title: "ساخت کد ناموفق بود", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function deleteCode(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/admin/pairing?id=${id}`, { method: "DELETE" });
      await onRefresh();
    } finally {
      setDeletingId(null);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "کپی ناموفق بود — به‌صورت دستی یادداشت کنید" });
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="w-5 h-5 text-primary" />
            ساخت کد جفت‌سازی
          </CardTitle>
          <CardDescription>
            کد را در اپ نگهبان (تنظیمات ← اتصال به پنل) وارد کنید تا گوشی به این پنل متصل شود.
            هر کد ۲۴ ساعت اعتبار دارد و فقط برای یک دستگاه قابل استفاده است.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="یادداشت (مثلاً: گوشی سارا)"
              className="flex-1"
              maxLength={100}
            />
            <Button onClick={createCode} disabled={creating} className="sm:w-40">
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4 me-1" />
                  ساخت کد
                </>
              )}
            </Button>
          </div>

          {lastCode && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-start">
                <p className="text-xs text-muted-foreground mb-1">کد جدید ساخته شد:</p>
                <p className="text-3xl font-bold tracking-[0.35em] text-primary" dir="ltr">
                  {faDigits(lastCode)}
                </p>
              </div>
              <Button variant="outline" onClick={() => copyCode(lastCode)} className="shrink-0">
                {copied ? (
                  <>
                    <Check className="w-4 h-4 me-1 text-neon-green" />
                    کپی شد
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 me-1" />
                    کپی کد
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">کدهای جفت‌سازی</CardTitle>
          <CardDescription>تاریخچه کدهای ساخته‌شده و وضعیت آن‌ها</CardDescription>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <KeyRound className="w-10 h-10 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">هنوز کدی ساخته نشده است</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto neon-scroll rounded-xl border border-border divide-y divide-border">
              {codes.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-secondary/50"
                >
                  <span className="text-lg font-bold tracking-widest" dir="ltr">
                    {faDigits(c.code)}
                  </span>
                  <CodeStatus item={c} />
                  {c.note && (
                    <span className="text-xs text-muted-foreground truncate max-w-40">
                      {c.note}
                    </span>
                  )}
                  <div className="ms-auto flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>ساخت: {timeAgo(c.createdAt)}</span>
                    <span>انقضا: {fmtDateTime(c.expiresAt)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteCode(c.id)}
                      disabled={deletingId === c.id}
                      aria-label="حذف کد"
                    >
                      {deletingId === c.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-neon-cyan" />
            راهنمای اتصال گوشی
          </h3>
          <ol className="space-y-2.5 text-sm text-muted-foreground list-decimal list-inside">
            <li>اپ نگهبان را روی گوشی سوژه نصب و راه‌اندازی کنید (رمز والد را فراموش نکنید).</li>
            <li>در اپ وارد «تنظیمات ← اتصال به پنل مدیریت» شوید.</li>
            <li>آدرس همین پنل را در فیلد «آدرس سرور» وارد کنید (مثال: https://myapp.up.railway.app).</li>
            <li>کد جفت‌سازی ساخته‌شده در بالا را وارد کرده و «اتصال» را بزنید.</li>
            <li>از این پس هر ۱۵ دقیقه (و با هر باز شدن اپ) گزارش برنامه‌ها و کارکرد گوشی به‌صورت خودکار ارسال می‌شود.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
