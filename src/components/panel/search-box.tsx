"use client";

import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * جعبه‌ی جستجوی استاندارد برای پنل نگهبان.
 *
 * ویژگی‌ها:
 * - آیکون جستجوی سمت راست (RTL-friendly با `start-2.5`)
 * - دکمه‌ی پاک‌سازی (X) فقط وقتی مقداری وجود دارد
 * - کلید Escape مقدار را پاک می‌کند
 * - کلید "/" کیبورد فوکس را به این جعبه می‌آورد (در صورت فعال‌بودن)
 * - کاملاً RTL با پدینگ مناسب
 */
export function SearchBox({
  value,
  onChange,
  placeholder,
  autoFocus,
  className = "",
  shortcut = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** فعال‌سازی میانبر «/» برای فوکس روی این جعبه */
  shortcut?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // میانبر «/» برای فوکس
  useEffect(() => {
    if (!shortcut) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      // اگر کاربر داخل input/textarea است، مزاحم نشو
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  return (
    <div className={"relative flex-1 min-w-44 " + className}>
      <Search className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            // جلوگیری از بسته‌شدن دیالوگ والد (radix Dialog) وقتی کاربر
            // می‌خواهد فقط جستجو را پاک کند.
            // stopImmediatePropagation روی nativeEvent ضروری است چون
            // preventDefault به‌تنهایی روی listenerهای radix در سطح document
            // اثر ندارد.
            e.preventDefault();
            e.stopPropagation();
            // native event را هم در همین لحظه متوقف کن
            const native = e.nativeEvent;
            if (native && typeof (native as any).stopImmediatePropagation === "function") {
              (native as any).stopImmediatePropagation();
            }
            onChange("");
            // فوکس را روی خود input نگه می‌داریم تا کاربر بتواند دوباره تایپ کند
            requestAnimationFrame(() => inputRef.current?.focus());
          }
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="h-9 ps-8 pe-8 text-xs bg-secondary/40 border-border focus-visible:bg-background focus-visible:border-primary/60 transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          aria-label="پاک کردن جستجو"
          className="absolute end-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/15 hover:bg-muted-foreground/30 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
