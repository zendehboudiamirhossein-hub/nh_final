"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2, LockKeyhole } from "lucide-react";

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "ورود ناموفق بود");
      }
    } catch {
      setError("خطای شبکه — دوباره تلاش کنید");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* پس‌زمینه‌ی گرادینتی متحرک */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(139,124,255,0.18) 0%, transparent 50%)," +
            "radial-gradient(circle at 80% 70%, rgba(0,229,160,0.15) 0%, transparent 50%)," +
            "radial-gradient(circle at 50% 100%, rgba(255,180,84,0.10) 0%, transparent 60%)," +
            "linear-gradient(to bottom, #0a0e17 0%, #101624 100%)",
        }}
      />
      {/* نقاط نئونی متحرک */}
      <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute top-1/4 start-1/4 w-2 h-2 rounded-full bg-neon-green animate-ping" style={{ animationDuration: "3s" }} />
        <div className="absolute top-1/3 end-1/4 w-2 h-2 rounded-full bg-neon-cyan animate-ping" style={{ animationDuration: "4s", animationDelay: "1s" }} />
        <div className="absolute bottom-1/3 start-1/3 w-2 h-2 rounded-full bg-neon-pink animate-ping" style={{ animationDuration: "5s", animationDelay: "2s" }} />
        <div className="absolute bottom-1/4 end-1/3 w-2 h-2 rounded-full bg-neon-orange animate-ping" style={{ animationDuration: "4.5s", animationDelay: "0.5s" }} />
      </div>

      <Card className="w-full max-w-sm border-border bg-card/95 backdrop-blur-sm neon-glow-purple">
        <CardHeader className="text-center space-y-3">
          <div className="relative mx-auto">
            {/* هاله‌ی متحرک پشت آیکون */}
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
            <div className="relative mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-neon-cyan/20 border border-primary/30 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-xl bg-gradient-to-l from-primary via-neon-cyan to-neon-green bg-clip-text text-transparent">
              پنل مدیریت نگهبان
            </CardTitle>
            <CardDescription className="mt-2">
              برای مشاهده گزارش دستگاه‌ها، رمز مدیریت را وارد کنید
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <LockKeyhole className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                dir="ltr"
                placeholder="رمز مدیریت"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ps-9 text-left bg-secondary/40 border-border focus-visible:bg-background focus-visible:border-primary/60 transition-colors"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-destructive text-center bg-destructive/10 border border-destructive/30 rounded-lg py-2 px-3">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-gradient-to-l from-primary to-neon-cyan/80 hover:from-primary/90 hover:to-neon-cyan/70 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  در حال ورود…
                </>
              ) : (
                "ورود به پنل"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
