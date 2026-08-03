import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Bell, CheckCheck, ExternalLink, Inbox, Loader2, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { safeFetch } from "../providers";
import { openExternalUrl } from "../platform";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { INBOX_REFRESH_EVENT, INBOX_UNREAD_CHANGED_EVENT } from "../components/InboxBadge";
import { useMdModules } from "./chat/hooks/useMdModules";
import type { InboxListResponse, InboxMessage } from "../inboxTypes";
import { isHighPriorityInbox } from "../inboxTypes";
import {
  fetchRuoyiNoticeDetail,
  fetchRuoyiNoticesTop,
  isRuoyiAuthEnabled,
  mapRuoyiNoticeToInboxMessage,
  markRuoyiNoticeRead,
  markRuoyiNoticesReadAll,
} from "../platform/ruoyi";

type InboxViewProps = {
  apiBaseUrl: string;
  serviceRunning: boolean;
  refreshKey?: number;
  onUnreadChange?: (count: number) => void;
};

/** 从消息中拼出可搜索文本（含 RuoYi 原始 HTML 正文） */
function searchableText(message: InboxMessage): string {
  const raw = message.raw || {};
  const html = String(raw.noticeContent || "");
  const plainFromHtml = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  return [
    message.title,
    message.body_markdown,
    message.source,
    plainFromHtml,
    raw.remark,
    raw.createBy,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function isUnread(message: InboxMessage): boolean {
  return !message.read_at && !message.dismissed_at;
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function typeLabelKey(type: string): string {
  const key = String(type || "notice").toLowerCase();
  if (key === "update") return "inbox.typeUpdate";
  if (key === "security") return "inbox.typeSecurity";
  if (key === "activity") return "inbox.typeActivity";
  if (key === "tip") return "inbox.typeTip";
  return "inbox.typeNotice";
}

function messageIcon(message: InboxMessage) {
  const type = String(message.type || "").toLowerCase();
  if (type === "security") return <ShieldAlert size={18} />;
  if (type === "update") return <RefreshCw size={18} />;
  if (isHighPriorityInbox(message.priority)) return <AlertTriangle size={18} />;
  return <Bell size={18} />;
}

export function InboxView({
  apiBaseUrl,
  serviceRunning,
  refreshKey = 0,
  onUnreadChange,
}: InboxViewProps) {
  const { t } = useTranslation();
  const mdModules = useMdModules();
  const ruoyiMode = isRuoyiAuthEnabled();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const publishUnread = useCallback((count: number) => {
    const next = Math.max(0, count);
    setUnreadCount(next);
    onUnreadChange?.(next);
    window.dispatchEvent(
      new CustomEvent(INBOX_UNREAD_CHANGED_EVENT, {
        detail: { unreadCount: next },
      }),
    );
  }, [onUnreadChange]);

  const fetchMessages = useCallback(async (showLoading = false) => {
    // [OpenAkita-RuoYi] 正式环境通知来自 RuoYi sys_notice，不依赖本地 FastAPI
    if (ruoyiMode) {
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const { rows, unreadCount: unread } = await fetchRuoyiNoticesTop(50);
        const nextMessages = rows.map((n) => mapRuoyiNoticeToInboxMessage(n));
        setMessages(nextMessages);
        publishUnread(unread);
        setSelectedId((current) => {
          if (current && nextMessages.some((message) => message.id === current)) return current;
          return nextMessages[0]?.id || null;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (showLoading) setLoading(false);
      }
      return;
    }

    if (!serviceRunning) {
      setMessages([]);
      publishUnread(0);
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const resp = await safeFetch(`${apiBaseUrl}/api/inbox/messages`, {
        signal: AbortSignal.timeout(8_000),
      });
      const data: InboxListResponse = await resp.json();
      const nextMessages = Array.isArray(data.messages) ? data.messages : [];
      setMessages(nextMessages);
      publishUnread(Number(data.unread_count || 0));
      setSelectedId((current) => {
        if (current && nextMessages.some((message) => message.id === current)) return current;
        return nextMessages[0]?.id || null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [apiBaseUrl, publishUnread, ruoyiMode, serviceRunning]);

  useEffect(() => {
    void fetchMessages(true);
  }, [fetchMessages, refreshKey]);

  useEffect(() => {
    const onRefresh = () => { void fetchMessages(false); };
    window.addEventListener(INBOX_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(INBOX_REFRESH_EVENT, onRefresh);
  }, [fetchMessages]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return messages;
    return messages.filter((message) => searchableText(message).includes(normalizedQuery));
  }, [messages, query]);

  const selected = useMemo(() => {
    if (!filtered.length) return null;
    if (selectedId) {
      const hit = filtered.find((message) => message.id === selectedId);
      if (hit) return hit;
    }
    return filtered[0];
  }, [filtered, selectedId]);

  // 搜索结果变化时，若当前选中不在结果内，自动切到第一条
  useEffect(() => {
    if (!filtered.length) {
      if (selectedId) setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((m) => m.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  // 选中 RuoYi 通知：补正文；列表已带正文时仅标记已读
  useEffect(() => {
    if (!ruoyiMode || !selected?.id?.startsWith("ruoyi-notice-")) return;
    const noticeId = Number(selected.raw?.noticeId);
    if (!noticeId) return;
    let cancelled = false;

    if (selected.body_markdown) {
      if (!selected.read_at) {
        void markRuoyiNoticeRead(noticeId).then((next) => {
          if (cancelled || next < 0) return;
          publishUnread(next);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === selected.id
                ? { ...m, read_at: m.read_at || new Date().toISOString() }
                : m,
            ),
          );
        });
      }
      return () => { cancelled = true; };
    }

    void fetchRuoyiNoticeDetail(noticeId).then((detail) => {
      if (cancelled || !detail) return;
      const mapped = mapRuoyiNoticeToInboxMessage(detail);
      setMessages((prev) => prev.map((m) => (m.id === mapped.id ? { ...m, ...mapped } : m)));
      publishUnread(Math.max(0, unreadCount - (selected.read_at ? 0 : 1)));
    });
    return () => { cancelled = true; };
  }, [ruoyiMode, selected?.id, selected?.body_markdown, selected?.raw?.noticeId, selected?.read_at, unreadCount, publishUnread]);

  const refreshNow = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      if (!ruoyiMode) {
        if (!serviceRunning) return;
        await safeFetch(`${apiBaseUrl}/api/inbox/refresh`, { method: "POST" });
      }
      await fetchMessages(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }, [apiBaseUrl, fetchMessages, refreshing, ruoyiMode, serviceRunning]);

  const markEvent = useCallback(async (message: InboxMessage, event: "read" | "dismiss" | "clicked") => {
    if (!message?.id) return;
    setBusyId(`${event}:${message.id}`);
    try {
      if (ruoyiMode && message.id.startsWith("ruoyi-notice-")) {
        const noticeId = Number(message.raw?.noticeId);
        if (noticeId && (event === "read" || event === "dismiss")) {
          const next = await markRuoyiNoticeRead(noticeId);
          if (next >= 0) publishUnread(next);
        }
        await fetchMessages(false);
        return;
      }
      const endpoint = event === "dismiss" ? "dismiss" : event;
      const resp = await safeFetch(`${apiBaseUrl}/api/inbox/messages/${encodeURIComponent(message.id)}/${endpoint}`, {
        method: "POST",
      });
      const data = await resp.json();
      if (typeof data?.unread_count === "number") publishUnread(data.unread_count);
      await fetchMessages(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }, [apiBaseUrl, fetchMessages, publishUnread, ruoyiMode]);

  const openCta = useCallback(async (message: InboxMessage) => {
    const url = message.cta?.url;
    if (typeof url !== "string" || !url.trim()) return;
    await markEvent(message, "clicked");
    await openExternalUrl(url);
  }, [markEvent]);

  const markAllRead = useCallback(async () => {
    if (!ruoyiMode) return;
    const ids = messages
      .filter((m) => isUnread(m) && m.id.startsWith("ruoyi-notice-"))
      .map((m) => Number(m.raw?.noticeId))
      .filter((id) => !!id);
    if (!ids.length) return;
    const next = await markRuoyiNoticesReadAll(ids);
    if (next >= 0) publishUnread(next);
    await fetchMessages(false);
  }, [fetchMessages, messages, publishUnread, ruoyiMode]);

  if (!ruoyiMode && !serviceRunning) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-sm text-center">
          <Inbox size={36} className="mx-auto mb-3 text-muted-foreground/35" />
          <h2 className="text-base font-semibold">{t("inbox.serviceNotRunning")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("inbox.serviceNotRunningHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inboxView">
      <div className="inboxHeader">
        <div className="min-w-0">
          <h1 className="inboxTitle">{t("inbox.title")}</h1>
          <p className="inboxSubtitle">{t("inbox.description")}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {ruoyiMode && unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => { void markAllRead(); }}>
              <CheckCheck size={14} />
              {t("inbox.markAllRead", { defaultValue: "全部已读" })}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={refreshNow} disabled={refreshing}>
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {t("inbox.refresh")}
          </Button>
        </div>
      </div>

      <div className="inboxToolbar">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/55" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("inbox.searchPlaceholder")}
            className="pl-8"
            aria-label={t("inbox.searchPlaceholder")}
          />
        </div>
      </div>

      {error && (
        <div className="inboxError">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-16 text-muted-foreground">
          <Loader2 size={24} className="mr-2 animate-spin" />
          {t("common.loading")}
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <div className="text-center">
            <Inbox size={40} className="mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t("inbox.empty")}</p>
          </div>
        </div>
      ) : (
        <div className="inboxLayout">
          <div className="inboxList">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">{t("inbox.noResults")}</div>
            ) : filtered.map((message) => {
              const selectedRow = selected?.id === message.id;
              const unread = isUnread(message);
              const important = isHighPriorityInbox(message.priority);
              return (
                <button
                  key={message.id}
                  data-slot="inbox-list-item"
                  className={`inboxListItem${selectedRow ? " inboxListItemActive" : ""}${unread ? " inboxListItemUnread" : ""}`}
                  onClick={() => setSelectedId(message.id)}
                >
                  <span className={`inboxListIcon${important ? " inboxListIconHot" : ""}`}>
                    {messageIcon(message)}
                  </span>
                  <span className="inboxListBody">
                    <span className="inboxListTop">
                      <span className="inboxListTitle">{message.title || t("inbox.untitled")}</span>
                      {unread && <span className="inboxUnreadDot" />}
                    </span>
                    <span className="inboxListMeta">
                      {t(typeLabelKey(message.type))}
                      {message.publish_at && <span>·</span>}
                      {message.publish_at && <span>{formatDate(message.publish_at)}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <Card className="inboxDetail">
            {selected ? (
              <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                <div className="inboxDetailHeader">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant={String(selected.type).toLowerCase() === "security" ? "destructive" : "secondary"}>
                        {t(typeLabelKey(selected.type))}
                      </Badge>
                    </div>
                    <h2 className="inboxDetailTitle">{selected.title || t("inbox.untitled")}</h2>
                    <p className="inboxDetailTime">
                      {formatDate(selected.publish_at || selected.received_at || null)}
                      {selected.expire_at ? ` · ${t("inbox.expiresAt", { time: formatDate(selected.expire_at) })}` : ""}
                    </p>
                  </div>
                  <div className="inboxDetailActions">
                    {!selected.read_at && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === `read:${selected.id}`}
                        onClick={() => markEvent(selected, "read")}
                      >
                        <CheckCheck size={14} />
                        {t("inbox.markRead")}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="inboxDetailBody">
                  {mdModules ? (
                    <div className="feedbackMdContent inboxMarkdown">
                      <mdModules.ReactMarkdown
                        remarkPlugins={mdModules.remarkPlugins}
                        rehypePlugins={mdModules.rehypePlugins}
                      >
                        {selected.body_markdown || t("inbox.emptyBody")}
                      </mdModules.ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-7">{selected.body_markdown || t("inbox.emptyBody")}</p>
                  )}
                </div>

                {selected.cta?.url && (
                  <div className="inboxDetailFooter">
                    <Button onClick={() => openCta(selected)} disabled={busyId === `clicked:${selected.id}`}>
                      <ExternalLink size={14} />
                      {selected.cta.label || t("inbox.openLink")}
                    </Button>
                  </div>
                )}
              </CardContent>
            ) : (
              <CardContent className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                {t("inbox.selectMessage")}
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
