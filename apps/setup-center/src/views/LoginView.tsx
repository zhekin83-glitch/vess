// ─── LoginView: 登录 / 注册 ───
// [OpenAkita-RuoYi] 正式环境：RuoYi 用户名+密码；关闭本地单密码

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { login, loginWithUsername } from "../platform/auth";
import {
  isRuoyiAuthEnabled,
  setRuoyiBaseUrl,
  ruoyiRegister,
} from "../platform/ruoyi";
import { IS_CAPACITOR } from "../platform/detect";
import { IconLink } from "../icons";
import logoUrl from "../assets/logo.png";

export function LoginView({
  apiBaseUrl,
  onLoginSuccess,
  onSwitchServer,
  onPreview,
}: {
  apiBaseUrl: string;
  onLoginSuccess: () => void;
  onSwitchServer?: () => void;
  onPreview?: () => void;
}) {
  const { t } = useTranslation();
  const ruoyiMode = isRuoyiAuthEnabled();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (ruoyiMode) {
      if (!username.trim() || !password.trim()) return;
      setLoading(true);
      setError(null);
      setInfo(null);
      // 正式环境固定线上管理端，不再展示/允许修改地址
      setRuoyiBaseUrl();

      if (mode === "register") {
        const result = await ruoyiRegister(username.trim(), password, nickname.trim() || undefined);
        setLoading(false);
        if (result.success) {
          setInfo("注册成功，请等待管理员审核通过后再登录");
          setMode("login");
        } else {
          setError(result.error || "注册失败");
        }
        return;
      }

      const result = await loginWithUsername(username.trim(), password);
      setLoading(false);
      if (result.success) {
        onLoginSuccess();
      } else {
        const code = result.errorCode || "";
        if (code === "PENDING_AUDIT") {
          setError("账号待审核，请等待管理员在后台授权");
        } else if (code === "REJECTED") {
          setError(result.error || "账号审核未通过");
        } else {
          setError(result.error || t("login.failed"));
        }
      }
      return;
    }

    // 原生单密码（仅调试关闭 RuoYi 时）
    if (!password.trim()) return;
    setLoading(true);
    setError(null);
    const result = await login(password, apiBaseUrl);
    setLoading(false);
    if (result.success) {
      onLoginSuccess();
    } else {
      const raw = (result.error || "").toLowerCase();
      if (raw.includes("too many")) {
        setError(t("login.tooManyAttempts"));
      } else if (raw.includes("invalid password")) {
        setError(t("login.invalidPassword"));
      } else if (raw.includes("abort") || raw.includes("timeout")) {
        setError(t("login.timeout"));
      } else if (raw.includes("failed to fetch") || raw.includes("networkerror") || raw.includes("fetch failed") || raw.includes("network") || raw.includes("load failed")) {
        setError(IS_CAPACITOR ? t("login.networkErrorMobile") : t("login.networkError"));
      } else {
        setError(result.error || t("login.failed"));
      }
    }
  }, [ruoyiMode, mode, username, password, nickname, apiBaseUrl, onLoginSuccess, t]);

  const serverDisplay = apiBaseUrl ? apiBaseUrl.replace(/^https?:\/\//, "") : "";
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    fontSize: 15,
    borderRadius: 10,
    border: "1px solid var(--line, #e2e8f0)",
    background: "var(--bg, #f8fafc)",
    color: "var(--text, #1e293b)",
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 12,
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      width: "100vw",
      background: "linear-gradient(135deg, var(--bg, #f8fafc) 0%, var(--panel, #e2e8f0) 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: "var(--text, #334155)",
      padding: 32,
      paddingTop: IS_CAPACITOR ? "max(32px, env(safe-area-inset-top))" : 32,
      boxSizing: "border-box",
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          background: "var(--panel2, #fff)",
          borderRadius: 16,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          padding: "40px 48px",
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
        }}
      >
        <img
          src={logoUrl}
          alt="器灵Vess"
          style={{
            width: 120,
            height: 120,
            marginBottom: 12,
            borderRadius: 12,
            display: "block",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        />
        <h2 style={{
          margin: ruoyiMode && mode === "login" ? "0 0 24px" : "0 0 8px",
          fontSize: 20,
          fontWeight: 600,
          color: "var(--text, #1e293b)",
        }}>
          {ruoyiMode ? "器灵Vess" : "器灵Vess Web"}
        </h2>
        {/* [器灵/VESS] 登录页不展示「使用 RuoYi 账号登录」；注册模式保留提示 */}
        {(ruoyiMode ? mode === "register" : true) && (
          <p style={{
            margin: "0 0 20px",
            fontSize: 14,
            color: "var(--text3, #64748b)",
            lineHeight: 1.6,
          }}>
            {ruoyiMode ? "注册账号（需管理员审核）" : t("login.prompt")}
          </p>
        )}

        {IS_CAPACITOR && serverDisplay && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            marginBottom: 16, padding: "6px 12px", borderRadius: 8,
            background: "var(--bg, #f1f5f9)", fontSize: 12, color: "var(--text3, #64748b)",
          }}>
            <IconLink size={13} style={{ opacity: 0.6, flexShrink: 0 }} />
            <span style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{serverDisplay}</span>
          </div>
        )}

        {error && (
          <div style={{
            background: "var(--error-bg, #fef2f2)",
            color: "var(--error, #dc2626)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 13,
            marginBottom: 16,
            textAlign: "left",
            whiteSpace: "pre-line",
            lineHeight: 1.6,
          }}>
            {error}
          </div>
        )}

        {info && (
          <div style={{
            background: "#ecfdf5",
            color: "#047857",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 13,
            marginBottom: 16,
            textAlign: "left",
            lineHeight: 1.6,
          }}>
            {info}
          </div>
        )}

        {/* [OpenAkita-RuoYi] 管理端地址已固定为线上，不再展示输入框 */}

        {ruoyiMode && (
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名"
            autoFocus
            disabled={loading}
            style={inputStyle}
          />
        )}

        {ruoyiMode && mode === "register" && (
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="昵称（可选）"
            disabled={loading}
            style={inputStyle}
          />
        )}

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={ruoyiMode ? "密码" : t("login.passwordPlaceholder")}
          autoFocus={!ruoyiMode}
          disabled={loading}
          style={{ ...inputStyle, marginBottom: 16 }}
        />

        <button
          type="submit"
          disabled={loading || !password.trim() || (ruoyiMode && !username.trim())}
          style={{
            width: "100%",
            background: loading
              ? "var(--text3, #94a3b8)"
              : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 0",
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
            opacity: loading || !password.trim() ? 0.7 : 1,
          }}
        >
          {loading
            ? (mode === "register" ? "提交中..." : t("login.loggingIn"))
            : (mode === "register" ? "注册" : t("login.submit"))}
        </button>

        {ruoyiMode && (
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
              setInfo(null);
            }}
            style={{
              width: "100%",
              marginTop: 12,
              background: "none",
              border: "none",
              padding: "8px 0",
              fontSize: 13,
              color: "var(--brand, #2563eb)",
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            {mode === "login" ? "没有账号？去注册" : "已有账号？去登录"}
          </button>
        )}

        {onSwitchServer && (
          <button
            type="button"
            onClick={onSwitchServer}
            style={{
              width: "100%",
              marginTop: 12,
              background: "none",
              border: "1px solid var(--line, #e2e8f0)",
              borderRadius: 10,
              padding: "9px 0",
              fontSize: 14,
              color: "var(--text3, #64748b)",
              cursor: "pointer",
            }}
          >
            {t("login.switchServer", { defaultValue: "切换 / 添加服务器" })}
          </button>
        )}

        {/* 正式环境关闭预览跳过 */}
        {!ruoyiMode && onPreview && (
          <button
            type="button"
            onClick={onPreview}
            style={{
              width: "100%",
              marginTop: 10,
              background: "none",
              border: "none",
              padding: "8px 0",
              fontSize: 13,
              color: "var(--text3, #94a3b8)",
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            {t("login.preview", { defaultValue: "跳过连接，预览界面" })}
          </button>
        )}
      </form>
    </div>
  );
}
