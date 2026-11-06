"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import type { LocationInfo, LocationPingItem } from "./types";
import { fmtDateTime, faDigits } from "./format";

/**
 * نقشه‌ی جهان تعاملی با موقعیت دقیق دستگاه:
 * - کاشی‌های OpenStreetMap (رایگان، بدون نیاز به API key)
 * - نقطه‌ی نئونی چشمک‌زن روی آخرین موقعیت + دایره‌ی دقت
 * - نقطه‌های کوچک بنفش برای تاریخچه (۳۰ مورد آخر)
 * - زوم با اسکرول/دکمه‌ها از سطح جهان (۲) تا خیابان (۱۹)
 *
 * نکته: کاشی‌های CARTO dark_all اخیراً به API key نیاز دارند (خطای
 * "API KEY REQUIRED"). به‌جای آن از کاشی‌های استاندارد OpenStreetMap استفاده
 * می‌کنیم که همیشه رایگان و قابل دسترس هستند.
 */

function Recenter({ pos }: { pos: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(pos, map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos[0], pos[1]]);
  return null;
}

function coordText(v: number): string {
  return faDigits(v.toFixed(5));
}

export default function DeviceMap({
  location,
  pings,
}: {
  location: LocationInfo | null;
  pings: LocationPingItem[];
}) {
  const pos: [number, number] | null = location
    ? [location.lat, location.lng]
    : null;

  const pinIcon = useMemo(
    () =>
      L.divIcon({
        className: "negahban-pin",
        html: '<div class="negahban-pin-pulse"></div><div class="negahban-pin-dot"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
    []
  );

  // تاریخچه بدون نقطه‌ی آخر (خودش با پین بزرگ نمایش داده می‌شود)
  const history = useMemo(() => pings.slice(1).slice(0, 30), [pings]);

  if (!location || !pos) {
    return (
      <p className="text-center text-muted-foreground text-xs py-10">
        هنوز موقعیتی از این گوشی دریافت نشده — مجوز «موقعیت مکانی» را در اپ
        نگهبان روی گوشی بدهید
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* اطلاعات آخرین موقعیت */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-muted-foreground">
          آخرین گزارش: {fmtDateTime(location.at)} ({faDigits(pings.length)} نقطه)
        </span>
        {location.accuracy != null && (
          <span className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-muted-foreground">
            دقت: ~{faDigits(Math.round(location.accuracy))} متر
          </span>
        )}
        {location.provider && (
          <span className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-muted-foreground">
            منبع: {location.provider}
          </span>
        )}
        <span
          className="rounded-full border border-neon-green/30 bg-neon-green/10 px-2.5 py-1 text-neon-green font-medium"
          dir="ltr"
        >
          {coordText(location.lat)}, {coordText(location.lng)}
        </span>
      </div>

      {/* نقشه */}
      <div
        className="rounded-xl overflow-hidden border border-border bg-secondary/40"
        dir="rtl"
      >
        <MapContainer
          center={pos}
          zoom={17}
          minZoom={2}
          maxZoom={19}
          scrollWheelZoom
          className="h-80 w-full"
          style={{ background: "#0a0e17" }}
        >
          {/*
            کاشی‌های OpenStreetMap استاندارد (رایگان، بدون API key).
            CARTO dark_all اخیراً API key اجباری اضافه کرده و صفحه‌ی سیاه
            با نوشته‌ی «API KEY REQUIRED» می‌داد. OSM همیشه کار می‌کند.
            برای حفظ ظاهر تیره، یک لایه‌ی فیلتر CSS روی نقشه می‌اندازیم.
          */}
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
            subdomains="abc"
          />

          {/* دایره‌ی دقت موقعیت */}
          {location.accuracy != null && location.accuracy > 0 && (
            <Circle
              center={pos}
              radius={location.accuracy}
              pathOptions={{
                color: "#00e5a0",
                weight: 1,
                fillColor: "#00e5a0",
                fillOpacity: 0.12,
              }}
            />
          )}

          {/* نقطه‌ی اصلی (آخرین موقعیت دقیق) */}
          <Marker position={pos} icon={pinIcon}>
            <Popup>
              <div style={{ fontFamily: "Vazirmatn", direction: "rtl" }}>
                <strong>آخرین موقعیت دستگاه</strong>
                <br />
                {fmtDateTime(location.at)}
                <br />
                <span dir="ltr">
                  {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                </span>
                {location.accuracy != null && (
                  <>
                    <br />
                    دقت: ~{faDigits(Math.round(location.accuracy))} متر
                  </>
                )}
              </div>
            </Popup>
          </Marker>

          {/* تاریخچه‌ی مسیر */}
          {history.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={4}
              pathOptions={{
                color: "#8b7cff",
                weight: 1,
                fillColor: "#8b7cff",
                fillOpacity: 0.55,
              }}
            >
              <Popup>
                <div style={{ fontFamily: "Vazirmatn", direction: "rtl" }}>
                  {fmtDateTime(p.at)}
                  <br />
                  <span dir="ltr">
                    {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                  </span>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          <Recenter pos={pos} />
        </MapContainer>
      </div>

      <p className="text-[11px] text-muted-foreground">
        نقاط بنفش کوچک، گزارش‌های قبلی هستند — با اسکرول یا دکمه‌های +
        و − بین دید جهان (خروج ۲) تا خیابان (زوم ۱۹) حرکت کنید؛ نقطه‌ی سبز،
        آخرین موقعیت دقیق دستگاه است.
      </p>
    </div>
  );
}
