"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Bot, LoaderCircle, MessageCircle, Plus, Send, ShieldCheck, Globe2, FolderOpen } from "lucide-react";

type Conversation = { id: string; title: string; updated_at: string };
type CaseOption = { id: string; title: string; case_number: string | null; archive_number: string | null; status: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; created_at: string };

export default function AssistantChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [caseId, setCaseId] = useState("");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadIndex = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/assistant/chat", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "دریافت اطلاعات گفتگو ممکن نشد.");
      setConversations(data.conversations ?? []);
      setCases(data.cases ?? []);
      if (data.conversations?.length) {
        const first = data.conversations[0];
        setConversationId(first.id);
        await loadConversation(first.id);
      } else {
        setConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای نامشخص");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConversation = async (id: string) => {
    setError("");
    try {
      const response = await fetch(`/api/assistant/chat?conversationId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "گفتگو بارگذاری نشد.");
      setConversationId(id);
      setMessages(data.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای نامشخص");
    }
  };

  useEffect(() => { void loadIndex(); }, [loadIndex]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, sending]);

  const newConversation = () => {
    setConversationId(null);
    setMessages([]);
    setDraft("");
    setError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    setError("");
    setDraft("");
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: message,
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversationId,
          caseId: caseId || null,
          useWebSearch,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "پاسخ دریافت نشد.");
      setConversationId(data.conversationId);
      setMessages((current) => [
        ...current.filter((item) => item.id !== optimistic.id),
        optimistic,
        data.message,
      ]);
      setConversations((current) => {
        const known = current.find((item) => item.id === data.conversationId);
        const updated: Conversation = {
          id: data.conversationId,
          title: known?.title ?? message.replace(/\s+/g, " ").slice(0, 72),
          updated_at: new Date().toISOString(),
        };
        return [updated, ...current.filter((item) => item.id !== data.conversationId)];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "ارتباط برقرار نشد.");
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      setDraft(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="assistant-layout">
      <aside className="assistant-history">
        <div className="assistant-history-head">
          <Link href="/dashboard" className="assistant-back"><ArrowRight size={16} /> بازگشت به دفتر</Link>
          <button className="btn" type="button" onClick={newConversation}><Plus size={16} /> گفتگوی جدید</button>
        </div>
        <div className="assistant-history-title">گفتگوهای قبلی</div>
        <div className="assistant-history-list">
          {conversations.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`assistant-history-item ${conversationId === item.id ? "selected" : ""}`}
              onClick={() => void loadConversation(item.id)}
            >
              <MessageCircle size={16} />
              <span>{item.title}</span>
            </button>
          ))}
          {!loading && conversations.length === 0 && <p className="assistant-empty-small">هنوز گفتگویی ثبت نشده است.</p>}
        </div>
        <div className="assistant-security-note"><ShieldCheck size={17} /> تاریخچه این حساب در فضای خصوصی دفتر نگهداری می‌شود.</div>
      </aside>

      <main className="assistant-main">
        <header className="assistant-header">
          <div className="assistant-header-icon"><Bot size={23} /></div>
          <div>
            <div className="eyebrow">دستیار هوشمند دفتر</div>
            <h1>گفتگو با دستیار دانیال</h1>
            <p className="muted text-sm mt-1">پرسش حقوقی، تحلیل سند، نگارش متن و پرسش‌های عمومی</p>
          </div>
        </header>

        <div className="assistant-controls">
          <label className="assistant-control">
            <FolderOpen size={16} />
            <span>زمینه پرونده</span>
            <select className="field-input" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              <option value="">بدون اتصال به پرونده</option>
              {cases.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}{item.case_number ? ` · ${item.case_number}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="assistant-toggle">
            <input type="checkbox" checked={useWebSearch} onChange={(e) => setUseWebSearch(e.target.checked)} />
            <Globe2 size={16} /> جست‌وجوی وب برای اطلاعات روز
          </label>
        </div>

        {caseId && (
          <div className="assistant-privacy-banner">
            اطلاعات پرونده و متن استخراج‌شده اسناد متصل به آن، در صورت وجود، برای پردازش به سرویس هوش مصنوعی پیکربندی‌شده ارسال می‌شود. فقط پرونده‌ای را انتخاب کنید که پردازش آن مجاز است.
          </div>
        )}
        {useWebSearch && (
          <div className="assistant-privacy-banner">
            با فعال بودن جست‌وجوی وب، مدل می‌تواند برای پرسش جاری از ابزار جست‌وجوی وب استفاده کند؛ این قابلیت ممکن است هزینه API جداگانه داشته باشد.
          </div>
        )}

        <section className="assistant-transcript" aria-live="polite">
          {loading ? (
            <div className="assistant-welcome"><LoaderCircle className="animate-spin" size={24} /> در حال بارگذاری گفتگوها...</div>
          ) : messages.length === 0 ? (
            <div className="assistant-welcome">
              <div className="assistant-welcome-icon"><Bot size={30} /></div>
              <h2>چه کاری را شروع کنیم؟</h2>
              <p>سؤال خود را بنویسید. برای بررسی یک پرونده، آن را از فهرست زمینه پرونده انتخاب کنید.</p>
              <div className="assistant-suggestions">
                <button type="button" onClick={() => setDraft("این مسئله را از نظر حقوق ایران تحلیل کن و ادله موافق و مخالف را جداگانه بررسی کن.")}>تحلیل حقوقی</button>
                <button type="button" onClick={() => setDraft("برای این موضوع یک لایحه رسمی و مستند تنظیم کن.")}>تنظیم لایحه</button>
                <button type="button" onClick={() => setDraft("این موضوع را مرحله‌به‌مرحله بررسی و اقدام بعدی را مشخص کن.")}>برنامه اقدام</button>
              </div>
            </div>
          ) : (
            <div className="assistant-message-list">
              {messages.map((item) => (
                <article key={item.id} className={`assistant-message ${item.role}`}>
                  <div className="assistant-message-avatar">{item.role === "assistant" ? <Bot size={17} /> : "شما"}</div>
                  <div className="assistant-message-content">
                    <div className="assistant-message-label">{item.role === "assistant" ? "دستیار دانیال" : "شما"}</div>
                    <div className="assistant-message-text">{item.content}</div>
                  </div>
                </article>
              ))}
              {sending && <div className="assistant-thinking"><LoaderCircle size={17} className="animate-spin" /> در حال دریافت پاسخ...</div>}
              <div ref={bottomRef} />
            </div>
          )}
        </section>

        {error && <div className="assistant-error" role="alert">{error}</div>}

        <form onSubmit={submit} className="assistant-composer">
          <textarea
            className="field-input assistant-textarea"
            placeholder="پیام خود را بنویسید..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={12000}
            disabled={sending || loading}
          />
          <div className="assistant-composer-foot">
            <span>حداکثر ۱۲٬۰۰۰ نویسه · پاسخ‌ها ممکن است نیازمند بررسی وکیل باشند.</span>
            <button className="btn" type="submit" disabled={!draft.trim() || sending || loading}>
              {sending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
              ارسال پیام
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
