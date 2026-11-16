"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, RefreshCw, Link2, Unplug, ListChecks, LoaderCircle } from "lucide-react";

type Channel = { id: string; name: string; isMember: boolean; isPrivate: boolean; memberCount: number | null };
type Status = { connected: boolean; teamName: string | null; installedAt: string | null; appConfigured: boolean; scopes: string[] };
const statusText: Record<string, string> = {
  connected: "اتصال Slack با موفقیت برقرار شد.",
  cancelled: "فرایند اتصال لغو شد.",
  invalid_state: "اعتبارسنجی امنیتی OAuth ناموفق بود. دوباره تلاش کنید.",
  access_denied: "حساب شما مجوز مدیریت اتصال را ندارد.",
  configuration_error: "تنظیمات OAuth ناقص است.",
  oauth_failed: "Slack نصب برنامه را تأیید نکرد.",
  save_failed: "توکن دریافت شد، اما ذخیره امن آن در سامانه ناموفق بود.",
  callback_failed: "خطا در تکمیل فرایند اتصال Slack."
};

export default function SlackIntegration() {
  const [status, setStatus] = useState<Status | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState("");
  const [summary, setSummary] = useState("");
  const [messageCount, setMessageCount] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/integrations/slack/status", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "وضعیت اتصال خوانده نشد.");
      setStatus(d);
      if (d.connected) {
        const c = await fetch("/api/integrations/slack/channels", { cache: "no-store" });
        const cd = await c.json();
        if (!c.ok) throw new Error(cd.error || "فهرست کانال‌ها دریافت نشد.");
        setChannels(cd.channels ?? []);
      } else setChannels([]);
    } catch (e) { setError(e instanceof Error ? e.message : "خطای نامشخص"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const code = new URLSearchParams(window.location.search).get("status");
    if (code && statusText[code]) setNotice(statusText[code]);
  }, [load]);

  const createSummary = async () => {
    if (!selected) return;
    setWorking(true); setError(""); setSummary(""); setMessageCount(null);
    try {
      const r = await fetch("/api/integrations/slack/summary", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selected })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "خلاصه‌سازی انجام نشد.");
      setSummary(d.summary); setMessageCount(d.messageCount); setTruncated(Boolean(d.truncated));
    } catch (e) { setError(e instanceof Error ? e.message : "خطای نامشخص"); }
    finally { setWorking(false); }
  };

  const disconnect = async () => {
    if (!window.confirm("اتصال Slack از این دفتر حذف شود؟")) return;
    setWorking(true); setError("");
    try {
      const r = await fetch("/api/integrations/slack/disconnect", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "قطع اتصال انجام نشد.");
      setNotice("اتصال از این سامانه حذف شد. برای لغو دسترسی برنامه، آن را از Slack نیز حذف کنید.");
      setSummary(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "خطای نامشخص"); }
    finally { setWorking(false); }
  };

  return (
    <main className="main max-w-5xl mx-auto">
      <header className="topbar">
        <div>
          <Link href="/dashboard" className="text-sm text-slate-500 inline-flex items-center gap-2 mb-3"><ArrowRight size={16}/> بازگشت به داشبورد</Link>
          <div className="eyebrow">مرکز ارتباطات و مدیریت تصمیمات</div>
          <h1>اتصال Slack به دستیار دانیال</h1>
          <p className="muted text-sm mt-2">مدیریت اتصال Workspace، فهرست کانال‌ها و گزارش هفتگی تصمیمات</p>
        </div>
      </header>

      {notice && <div className="card mb-4 text-sm flex items-center gap-2"><CheckCircle2 size={17} className="text-emerald-600"/>{notice}</div>}
      {error && <div className="card mb-4 border-amber-300 text-amber-900 text-sm flex gap-2"><CircleAlert size={17}/>{error}</div>}

      <section className="card mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="feature-icon"><Link2 size={20}/></div>
            <div>
              <h2 className="font-bold">وضعیت اتصال</h2>
              <p className="text-xs text-slate-500 mt-1">{loading ? "در حال بررسی..." : status?.connected ? "متصل به " + status.teamName : "هنوز Workspace به این دفتر متصل نشده است."}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn secondary" onClick={() => void load()} disabled={loading || working}><RefreshCw size={16}/> بررسی مجدد</button>
            {status?.connected ? (
              <button className="btn secondary" onClick={() => void disconnect()} disabled={working}><Unplug size={16}/> قطع اتصال</button>
            ) : (
              <a className="btn" href="/api/integrations/slack/connect"><Link2 size={16}/> اتصال به Slack</a>
            )}
          </div>
        </div>
        {!loading && !status?.appConfigured && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
            برای فعال‌سازی دکمه اتصال، مدیر سامانه باید سه متغیر محرمانه SLACK_CLIENT_ID، SLACK_CLIENT_SECRET و SLACK_TOKEN_ENCRYPTION_KEY را در Environment سرویس Render ثبت کند. این مقادیر نباید در کد یا مخزن GitHub قرار گیرند.
          </div>
        )}
        {status?.connected && <div className="mt-3 text-xs text-slate-500">مجوزهای ثبت‌شده: {status.scopes.join("، ") || "اطلاعاتی ثبت نشده است"}</div>}
      </section>

      {status?.connected && (
        <>
          <section className="card mb-5">
            <div className="flex items-center gap-2 mb-4"><ListChecks size={19}/><h2 className="font-bold">کانال‌های در دسترس</h2></div>
            <div className="flex flex-wrap gap-2 items-center">
              <select className="field-input min-w-64 flex-1" value={selected} onChange={(e) => setSelected(e.target.value)}>
                <option value="">انتخاب کانال برای گزارش هفتگی</option>
                {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}{c.isPrivate ? " · خصوصی" : ""}{!c.isMember ? " · برنامه عضو نیست" : ""}</option>)}
              </select>
              <button className="btn" onClick={() => void createSummary()} disabled={!selected || working}>
                {working ? <LoaderCircle size={16} className="animate-spin"/> : <ListChecks size={16}/>} تحلیل ۷ روز اخیر
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-3 leading-6">کانال خصوصی فقط در صورتی قابل خواندن است که برنامه Slack به آن دعوت شده باشد. برای تحلیل، متن پیام‌های کانال انتخابی به سرویس هوش مصنوعی پیکربندی‌شده ارسال می‌شود؛ اطلاعات پرونده‌های سامانه به Slack ارسال نمی‌شود.</p>
            {channels.length === 0 && <p className="text-sm text-slate-500 mt-3">کانالی برنگشت. دسترسی channels:read و عضویت برنامه در کانال بررسی شود.</p>}
          </section>

          {summary && <section className="card">
            <div className="flex flex-wrap justify-between gap-2 mb-3"><h2 className="font-bold">گزارش هفت روز اخیر</h2><span className="text-xs text-slate-500">{messageCount} پیام بررسی‌شده</span></div>
            {truncated && <p className="text-xs text-amber-700 mb-3">به دلیل محدودیت بازیابی، ممکن است همه پیام‌های این بازه در گزارش نباشند.</p>}
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-8">{summary}</pre>
          </section>}
        </>
      )}
    </main>
  );
}
