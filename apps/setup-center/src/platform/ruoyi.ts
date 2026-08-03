/**
 * [OpenAkita-RuoYi] RuoYi 管理端对接
 * - 正式环境必须使用 RuoYi 账号（JWT），不再使用本地单密码
 * - 模型列表从 RuoYi 拉取；按编码拆到聊天 / 编译 / 生图 / STT 本地端点
 * - LLM 走 /chat/completions；生图/STT 走同前缀下对应路径（需服务端中转）
 */

/** 正式环境固定管理端地址（不再允许用户填写） */
export const RUOYI_PRODUCTION_BASE_URL = "http://agent.lanmeiti.cn";

const RUOYI_BASE_KEY = "openakita_ruoyi_base_url";
const RUOYI_REFRESH_KEY = "openakita_ruoyi_refresh_token";
/** 默认开启 RuoYi 鉴权；localStorage 设为 "0" 可临时关闭（仅调试） */
const RUOYI_ENABLED_KEY = "openakita_ruoyi_auth";

const ACCESS_TOKEN_KEY = "openakita_access_token";

export type RuoyiAuthResult = {
  success: boolean;
  error?: string;
  errorCode?: string;
};

export type RuoyiModel = {
  modelCode: string;
  displayName: string;
  provider?: string;
  apiProtocol?: string;
  supportStream?: string;
  sortOrder?: number;
  /** 与 EndpointConfig.capabilities 对齐：text/thinking/vision/video/tools/... */
  capabilities?: string[];
  remark?: string;
};

/** 本地端点分桶：与 OpenAkita EndpointManager 的 list key 一致 */
export type RuoyiEndpointBucket =
  | "endpoints"
  | "compiler_endpoints"
  | "image_endpoints"
  | "stt_endpoints";

/**
 * 按模型编码约定归类（与后台模型编码对齐）：
 * - vess / 其它 → 主聊天
 * - vess-x → 提示词编译
 * - vess-image → 生图
 * - vess-stt → 语音识别
 */
export function classifyRuoyiModel(modelCode: string): RuoyiEndpointBucket {
  const c = (modelCode || "").trim().toLowerCase();
  if (!c) return "endpoints";
  if (c === "vess-image" || c.endsWith("-image") || /(^|[-_])image($|[-_])/.test(c)) {
    return "image_endpoints";
  }
  if (
    c === "vess-stt" ||
    c.endsWith("-stt") ||
    /(^|[-_])(stt|asr|whisper|sensevoice)($|[-_])/.test(c)
  ) {
    return "stt_endpoints";
  }
  if (c === "vess-x" || c.endsWith("-x") || c.includes("compiler")) {
    return "compiler_endpoints";
  }
  return "endpoints";
}

/** RuoYi 当前登录用户（/auth/me） */
export type RuoyiUserInfo = {
  userId?: number;
  username: string;
  nickname?: string;
  email?: string;
  auditStatus?: string;
};

/** 是否启用 RuoYi 账号体系（正式环境默认 true） */
export function isRuoyiAuthEnabled(): boolean {
  try {
    const v = localStorage.getItem(RUOYI_ENABLED_KEY);
    if (v === "0" || v === "false") return false;
  } catch { /* */ }
  return true;
}

/** 始终返回线上管理端地址 */
export function getRuoyiBaseUrl(): string {
  // 迁移：覆盖历史本地/旧地址
  try {
    localStorage.setItem(RUOYI_BASE_KEY, RUOYI_PRODUCTION_BASE_URL);
  } catch { /* */ }
  return RUOYI_PRODUCTION_BASE_URL;
}

export function setRuoyiBaseUrl(_url?: string): void {
  try {
    localStorage.setItem(RUOYI_BASE_KEY, RUOYI_PRODUCTION_BASE_URL);
  } catch { /* */ }
}

function apiRoot(): string {
  return `${getRuoyiBaseUrl()}/openakita/api/v1`;
}

export function getRuoyiAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setRuoyiTokens(access: string, refresh?: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  if (refresh) localStorage.setItem(RUOYI_REFRESH_KEY, refresh);
}

export function clearRuoyiTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(RUOYI_REFRESH_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(RUOYI_REFRESH_KEY);
}

async function parseAjax(res: Response): Promise<{ code: number; msg: string; data?: any; errorCode?: string }> {
  const data = await res.json().catch(() => ({}));
  return {
    code: typeof data.code === "number" ? data.code : res.status,
    msg: data.msg || data.message || `HTTP ${res.status}`,
    data: data.data,
    errorCode: data.errorCode,
  };
}

/** RuoYi 登录 */
export async function ruoyiLogin(username: string, password: string): Promise<RuoyiAuthResult> {
  try {
    const res = await fetch(`${apiRoot()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await parseAjax(res);
    if (body.code !== 0 || !body.data?.access_token) {
      return { success: false, error: body.msg, errorCode: body.errorCode };
    }
    setRuoyiTokens(body.data.access_token, body.data.refresh_token);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/** RuoYi 注册（待审） */
export async function ruoyiRegister(
  username: string,
  password: string,
  nickname?: string,
): Promise<RuoyiAuthResult> {
  try {
    const res = await fetch(`${apiRoot()}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, nickname: nickname || username }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await parseAjax(res);
    if (body.code !== 0) {
      return { success: false, error: body.msg, errorCode: body.errorCode };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/** 拉取当前登录用户信息（侧栏账号展示） */
export async function fetchRuoyiCurrentUser(): Promise<RuoyiUserInfo | null> {
  const token = getRuoyiAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${apiRoot()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 401) return null;
    const body = await parseAjax(res);
    if (body.code !== 0 || !body.data) return null;
    const username = String(body.data.username || "").trim();
    if (!username) return null;
    return {
      userId: body.data.userId,
      username,
      nickname: body.data.nickname ? String(body.data.nickname) : undefined,
      email: body.data.email ? String(body.data.email) : undefined,
      auditStatus: body.data.auditStatus ? String(body.data.auditStatus) : undefined,
    };
  } catch {
    return null;
  }
}

/** 校验当前 Token 是否有效 */
export async function checkRuoyiAuth(): Promise<boolean> {
  const token = getRuoyiAccessToken();
  if (!token) return false;
  try {
    const res = await fetch(`${apiRoot()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 401) {
      const refreshed = await refreshRuoyiToken();
      return !!refreshed;
    }
    const body = await parseAjax(res);
    return body.code === 0;
  } catch {
    return false;
  }
}

/** 刷新 Access Token */
export async function refreshRuoyiToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) {
    clearRuoyiTokens();
    return null;
  }
  try {
    const res = await fetch(`${apiRoot()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await parseAjax(res);
    if (body.code !== 0 || !body.data?.access_token) {
      clearRuoyiTokens();
      window.dispatchEvent(new Event("openakita-auth-expired"));
      return null;
    }
    setRuoyiTokens(body.data.access_token, body.data.refresh_token || refresh);
    // 通知前端：Access Token 已刷新，需同步到本地 LLM 端点
    try {
      window.dispatchEvent(new CustomEvent("openakita-ruoyi-token-refreshed"));
    } catch { /* */ }
    return body.data.access_token as string;
  } catch {
    return null;
  }
}

/** 拉取当前用户可用模型（兼容 OpenAI /v1/models 与旧版 AjaxResult） */
export async function fetchRuoyiModels(): Promise<RuoyiModel[]> {
  const token = getRuoyiAccessToken();
  if (!token) return [];
  const res = await fetch(`${apiRoot()}/models`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 401) return [];
  const raw = await res.json().catch(() => ({}));
  // OpenAI：{ object:"list", data:[{id,...}] }；旧版：{ code:0, data:{ models:[...] } }
  let list: any[] = [];
  if (Array.isArray(raw?.data)) {
    list = raw.data;
  } else if (Array.isArray(raw?.data?.models)) {
    list = raw.data.models;
  } else if (Array.isArray(raw?.models)) {
    list = raw.models;
  }
  return list
    .map((m: any) => {
      const capsRaw = m.capabilities ?? m.capability ?? m.caps;
      let capabilities: string[] | undefined;
      if (Array.isArray(capsRaw)) {
        capabilities = capsRaw.map((x: any) => String(x).trim().toLowerCase()).filter(Boolean);
      } else if (typeof capsRaw === "string" && capsRaw.trim()) {
        capabilities = capsRaw.split(/[,，\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
      }
      const sortRaw = m.sortOrder ?? m.sort_order;
      const sortOrder = sortRaw === undefined || sortRaw === null || sortRaw === ""
        ? undefined
        : Number(sortRaw);
      return {
        modelCode: m.id || m.modelCode || m.model_code,
        displayName: m.display_name || m.displayName || m.name || m.id || m.modelCode,
        provider: m.provider || m.owned_by,
        apiProtocol: m.apiProtocol || m.api_protocol,
        supportStream: m.supportStream || m.support_stream,
        sortOrder: Number.isFinite(sortOrder as number) ? (sortOrder as number) : undefined,
        capabilities,
        remark: m.remark || "",
      };
    })
    .filter((m: RuoyiModel) => !!m.modelCode)
    .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
}

/** 所有 RuoYi 中转端点共用的 JWT 环境变量名（登录/刷新时统一更新） */
export const RUOYI_ENDPOINT_API_KEY_ENV = "RUOYI_ACCESS_TOKEN";

/** 是否为 RuoYi 管理端同步下来的端点（能力/排序由后台决定；用户自建端点不算） */
export function isRuoyiManagedEndpoint(ep: {
  note?: string | null;
  api_key_env?: string | null;
  base_url?: string | null;
} | null | undefined): boolean {
  if (!ep) return false;
  const note = String(ep.note || "");
  // 以 note 标记为准；勿用 base_url 误判用户自建（用户也可指向同一中转地址）
  if (note.startsWith("[RuoYi]")) return true;
  // 历史同步项：共用 JWT env 且 note 为空时仍视为托管
  if (String(ep.api_key_env || "") === RUOYI_ENDPOINT_API_KEY_ENV && !note.trim()) {
    return true;
  }
  return false;
}

/** 从管理端拉取指定模型编码的能力列表；失败返回 null */
export async function fetchRuoyiModelCapabilities(modelCode: string): Promise<string[] | null> {
  const code = (modelCode || "").trim();
  if (!code || !isRuoyiAuthEnabled() || !getRuoyiAccessToken()) return null;
  try {
    const models = await fetchRuoyiModels();
    const hit = models.find((m) => m.modelCode === code);
    if (!hit) return null;
    const caps = normalizeRuoyiCapabilities(hit.capabilities);
    if (caps.length) return caps;
    return defaultRuoyiChatCapabilities(code);
  } catch {
    return null;
  }
}

/**
 * 将单个 RuoYi 模型转为对应分桶的本地端点（base_url 指向中转，api_key=JWT）
 */
export function buildRuoyiEndpointForBucket(
  model: RuoyiModel,
  accessToken: string,
  bucket: RuoyiEndpointBucket,
  priority: number,
): Record<string, unknown> {
  const baseUrl = `${apiRoot()}`;
  const note = `[RuoYi] ${model.displayName || model.modelCode}`;
  const fromServer = normalizeRuoyiCapabilities(model.capabilities);
  const common = {
    name: model.modelCode,
    provider: "openai",
    base_url: baseUrl,
    // 密钥走统一 env；save-endpoints 的 api_key 参数会写入该变量
    api_key_env: RUOYI_ENDPOINT_API_KEY_ENV,
    model: model.modelCode,
    priority,
    note,
  };
  if (bucket === "image_endpoints") {
    return {
      ...common,
      api_type: "openai_images",
      timeout: 180,
      capabilities: fromServer.includes("image_generation")
        ? fromServer
        : ["image_generation"],
      extra_params: { default_size: "1024x1024" },
    };
  }
  if (bucket === "stt_endpoints") {
    return {
      ...common,
      api_type: "openai",
      max_tokens: 0,
      context_window: 0,
      timeout: 60,
      capabilities: fromServer.length ? fromServer : ["text"],
    };
  }
  if (bucket === "compiler_endpoints") {
    return {
      ...common,
      api_type: "openai",
      max_tokens: 2048,
      context_window: 200000,
      timeout: 30,
      capabilities: fromServer.length ? fromServer : ["text"],
    };
  }
  return {
    ...common,
    api_type: "openai",
    max_tokens: 8192,
    context_window: 200000,
    timeout: 180,
    // 与管理端完全一致，不自动补 text/tools
    capabilities: fromServer.length ? fromServer : defaultRuoyiChatCapabilities(model.modelCode),
  };
}

/** 规范化后台下发的能力列表，并兼容中英文别名 */
export function normalizeRuoyiCapabilities(caps?: string[]): string[] {
  if (!caps?.length) return [];
  const alias: Record<string, string> = {
    image: "vision",
    tool: "tools",
    文本: "text",
    思考: "thinking",
    图片: "vision",
    视觉: "vision",
    视频: "video",
    工具: "tools",
    生图: "image_generation",
    画图: "image_generation",
    绘图: "image_generation",
  };
  const allowed = new Set(["text", "thinking", "vision", "video", "tools", "image_generation"]);
  const out: string[] = [];
  for (const raw of caps) {
    const original = String(raw || "").trim();
    if (!original) continue;
    const lower = original.toLowerCase();
    const c = alias[lower] || alias[original] || lower;
    if (allowed.has(c) && !out.includes(c)) out.push(c);
  }
  return out;
}

/** 管理端未下发能力时的聊天端点默认值（有下发时严格跟后台，不走此逻辑） */
export function defaultRuoyiChatCapabilities(modelCode: string): string[] {
  const c = (modelCode || "").toLowerCase();
  if (
    /(^|[-_.])vl([-_.]|$)/.test(c)
    || c.includes("vision")
    || c.includes("qwen2-vl")
    || c.includes("qwen3-vl")
    || c.includes("gpt-4o")
    || c.includes("gemini")
  ) {
    // 仅在管理端未返回 capabilities 时兜底；不擅自加 text
    return ["vision"];
  }
  return ["text", "tools"];
}

/** @deprecated 请用 buildRuoyiEndpointBuckets；保留兼容旧调用（仅聊天桶） */
export function buildRuoyiEndpointPayload(models: RuoyiModel[], accessToken: string): Record<string, unknown>[] {
  return models
    .filter((m) => classifyRuoyiModel(m.modelCode) === "endpoints")
    .map((m, idx) => buildRuoyiEndpointForBucket(m, accessToken, "endpoints", idx + 1));
}

/** 按端点类型拆分授权模型（优先级按后台 sortOrder） */
export function buildRuoyiEndpointBuckets(
  models: RuoyiModel[],
  accessToken: string,
): Record<RuoyiEndpointBucket, Record<string, unknown>[]> {
  const buckets: Record<RuoyiEndpointBucket, Record<string, unknown>[]> = {
    endpoints: [],
    compiler_endpoints: [],
    image_endpoints: [],
    stt_endpoints: [],
  };
  const sorted = [...models].sort(
    (a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999) || a.modelCode.localeCompare(b.modelCode),
  );
  const counters: Record<RuoyiEndpointBucket, number> = {
    endpoints: 0,
    compiler_endpoints: 0,
    image_endpoints: 0,
    stt_endpoints: 0,
  };
  for (const m of sorted) {
    const bucket = classifyRuoyiModel(m.modelCode);
    counters[bucket] += 1;
    // priority：同桶内按 sortOrder 顺序递增；若后台给了 sortOrder 则优先用它（越小越优先）
    const priority = m.sortOrder != null && Number.isFinite(m.sortOrder)
      ? Math.max(1, Math.floor(m.sortOrder) || 1)
      : counters[bucket];
    buckets[bucket].push(buildRuoyiEndpointForBucket(m, accessToken, bucket, priority));
  }
  return buckets;
}

async function listLocalBucketEndpoints(
  localBase: string,
  endpointType: RuoyiEndpointBucket,
): Promise<any[]> {
  try {
    const res = await fetch(`${localBase}/api/config/endpoints`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    if (Array.isArray(data?.raw?.[endpointType])) return data.raw[endpointType];
    if (endpointType === "endpoints" && Array.isArray(data?.endpoints)) return data.endpoints;
    return [];
  } catch {
    return [];
  }
}

/**
 * 写入 RuoYi 同步端点：只 upsert 托管项。
 * 若同名已是用户自建端点，则改用「模型编码 (RuoYi)」落盘，避免覆盖用户配置。
 */
async function saveRuoyiBucket(
  localBase: string,
  endpointType: RuoyiEndpointBucket,
  endpoints: Record<string, unknown>[],
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!endpoints.length) return { ok: true };
  const existingList = await listLocalBucketEndpoints(localBase, endpointType);
  const byName = new Map(
    existingList
      .map((e) => [String(e?.name || "").trim(), e] as const)
      .filter(([n]) => !!n),
  );
  const toSave: Record<string, unknown>[] = [];
  for (const ep of endpoints) {
    const item = { ...ep };
    const name = String(item.name || "").trim();
    if (!name) continue;
    const existing = byName.get(name);
    if (existing && !isRuoyiManagedEndpoint(existing)) {
      // 用户已用同名自建端点：并列保留管理端同步副本
      const alt = `${name} (RuoYi)`;
      item.name = alt;
      const altExisting = byName.get(alt);
      if (altExisting && !isRuoyiManagedEndpoint(altExisting)) {
        // 极端冲突：跳过，绝不覆盖用户端点
        continue;
      }
    }
    toSave.push(item);
  }
  if (!toSave.length) return { ok: true };
  const res = await fetch(`${localBase}/api/config/save-endpoints`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoints: toSave,
      api_key: accessToken,
      endpoint_type: endpointType,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `${endpointType}: HTTP ${res.status} ${text}` };
  }
  const data = await res.json().catch(() => ({}));
  if (data.status === "error" || data.status === "conflict") {
    return { ok: false, error: `${endpointType}: ${data.error || "保存失败"}` };
  }
  return { ok: true };
}

/** 仅清理 [RuoYi] 托管端点；绝不删除用户自建端点 */
async function pruneStaleRuoyiEndpoints(
  localBase: string,
  endpointType: RuoyiEndpointBucket,
  keepNames: Set<string>,
): Promise<void> {
  try {
    const list = await listLocalBucketEndpoints(localBase, endpointType);
    const stale: string[] = [];
    for (const ep of list) {
      if (!isRuoyiManagedEndpoint(ep)) continue;
      const name = String(ep?.name || "").trim();
      if (!name) continue;
      const model = String(ep?.model || "").trim();
      const kind = classifyRuoyiModel(model || name.replace(/\s*\(RuoYi\)\s*$/i, ""));
      // 聊天桶：清掉误放的 image/stt/compiler（仅托管项）
      if (endpointType === "endpoints" && kind !== "endpoints") {
        stale.push(name);
        continue;
      }
      // 已取消授权：name 或「name (RuoYi)」都不在 keep 中
      const bare = name.replace(/\s*\(RuoYi\)\s*$/i, "");
      if (!keepNames.has(name) && !keepNames.has(bare)) {
        stale.push(name);
        continue;
      }
      // 历史残留：托管项 name≠model，且 model 已在授权列表（旧命名 stt-provider-xxx）
      if (model && keepNames.has(model) && name !== model && name !== `${model} (RuoYi)`) {
        stale.push(name);
      }
    }
    const unique = [...new Set(stale)];
    if (!unique.length) return;
    await fetch(`${localBase}/api/config/endpoints`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: unique, endpoint_type: endpointType, clean_env: false }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    /* 清理失败不阻断主同步 */
  }
}

/**
 * 写入本地推理服务的端点配置（需本地 FastAPI 已启动）
 * 按授权模型拆到聊天 / 编译 / 生图 / STT 四个桶；
 * 所有桶共用 RUOYI_ACCESS_TOKEN，登录与 Token 刷新时整份 JWT 一并更新。
 */
export async function syncRuoyiModelsToLocal(localApiBase: string): Promise<{ ok: boolean; count: number; error?: string }> {
  const token = getRuoyiAccessToken();
  if (!token) return { ok: false, count: 0, error: "未登录 RuoYi" };
  try {
    const models = await fetchRuoyiModels();
    if (!models.length) {
      return { ok: false, count: 0, error: "暂无授权模型，请在 RuoYi 完成角色授权与上线" };
    }
    const buckets = buildRuoyiEndpointBuckets(models, token);
    const base = localApiBase.replace(/\/+$/, "");
    const types: RuoyiEndpointBucket[] = [
      "endpoints",
      "compiler_endpoints",
      "image_endpoints",
      "stt_endpoints",
    ];
    for (const t of types) {
      const keep = new Set(buckets[t].map((e) => String(e.name)));
      await pruneStaleRuoyiEndpoints(base, t, keep);
      // 每个非空桶都带同一 accessToken 写入，确保 RUOYI_ACCESS_TOKEN 最新
      const saved = await saveRuoyiBucket(base, t, buckets[t], token);
      if (!saved.ok) {
        return { ok: false, count: 0, error: saved.error || "保存端点失败" };
      }
    }
    try {
      localStorage.setItem("openakita_ruoyi_endpoints_cache", JSON.stringify(buckets));
    } catch { /* */ }
    return { ok: true, count: models.length };
  } catch (e) {
    return { ok: false, count: 0, error: String(e) };
  }
}

/** Token 刷新后重新写入全部 RuoYi 端点使用的 RUOYI_ACCESS_TOKEN */
export async function resyncRuoyiTokenToLocal(localApiBase: string): Promise<void> {
  if (!isRuoyiAuthEnabled() || !getRuoyiAccessToken()) return;
  await syncRuoyiModelsToLocal(localApiBase);
}

// ─── 通知公告（绑定 RuoYi sys_notice） ───

export type RuoyiNoticeBrief = {
  noticeId: number;
  noticeTitle: string;
  noticeType?: string;
  createBy?: string;
  createTime?: string;
  isRead?: boolean;
  noticeContent?: string;
  remark?: string;
};

async function authGet(path: string): Promise<{ code: number; msg: string; data?: any }> {
  const token = getRuoyiAccessToken();
  if (!token) return { code: 401, msg: "未登录" };
  const res = await fetch(`${apiRoot()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 401) {
    const refreshed = await refreshRuoyiToken();
    if (!refreshed) return { code: 401, msg: "未登录" };
    const retry = await fetch(`${apiRoot()}${path}`, {
      headers: { Authorization: `Bearer ${refreshed}` },
      signal: AbortSignal.timeout(10_000),
    });
    return parseAjax(retry);
  }
  return parseAjax(res);
}

async function authPost(path: string, body?: unknown): Promise<{ code: number; msg: string; data?: any }> {
  const token = getRuoyiAccessToken();
  if (!token) return { code: 401, msg: "未登录" };
  const doFetch = (t: string) =>
    fetch(`${apiRoot()}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshed = await refreshRuoyiToken();
    if (!refreshed) return { code: 401, msg: "未登录" };
    res = await doFetch(refreshed);
  }
  return parseAjax(res);
}

/** 未读通知数 */
export async function fetchRuoyiNoticeUnreadCount(): Promise<number> {
  const body = await authGet("/notices/unread-count");
  if (body.code !== 0) return 0;
  return Math.max(0, Number(body.data?.unreadCount || 0));
}

/** 最近通知列表（带已读标记） */
export async function fetchRuoyiNoticesTop(limit = 50): Promise<{
  rows: RuoyiNoticeBrief[];
  unreadCount: number;
}> {
  const body = await authGet(`/notices/top?limit=${limit}`);
  if (body.code !== 0) return { rows: [], unreadCount: 0 };
  const rows = Array.isArray(body.data?.rows) ? body.data.rows : [];
  return {
    rows: rows.map((n: any) => ({
      noticeId: Number(n.noticeId),
      noticeTitle: String(n.noticeTitle || ""),
      noticeType: n.noticeType,
      createBy: n.createBy,
      createTime: n.createTime,
      isRead: !!n.isRead,
      noticeContent: n.noticeContent,
      remark: n.remark,
    })),
    unreadCount: Math.max(0, Number(body.data?.unreadCount || 0)),
  };
}

/** 通知详情（服务端会标记已读） */
export async function fetchRuoyiNoticeDetail(noticeId: number): Promise<RuoyiNoticeBrief | null> {
  const body = await authGet(`/notices/${noticeId}`);
  if (body.code !== 0 || !body.data) return null;
  const n = body.data;
  return {
    noticeId: Number(n.noticeId),
    noticeTitle: String(n.noticeTitle || ""),
    noticeType: n.noticeType,
    createBy: n.createBy,
    createTime: n.createTime,
    isRead: true,
    noticeContent: n.noticeContent,
    remark: n.remark,
  };
}

/** 标记已读 */
export async function markRuoyiNoticeRead(noticeId: number): Promise<number> {
  const body = await authPost(`/notices/${noticeId}/read`);
  if (body.code !== 0) return -1;
  return Math.max(0, Number(body.data?.unreadCount || 0));
}

/** 批量标记已读 */
export async function markRuoyiNoticesReadAll(ids: number[]): Promise<number> {
  const body = await authPost("/notices/mark-read-all", { ids });
  if (body.code !== 0) return -1;
  return Math.max(0, Number(body.data?.unreadCount || 0));
}

/**
 * 将 RuoYi 通知映射为 Inbox 消息结构，便于复用 InboxView
 */
export function mapRuoyiNoticeToInboxMessage(
  n: RuoyiNoticeBrief,
  contentHtml?: string,
): import("../inboxTypes").InboxMessage {
  const html = contentHtml ?? n.noticeContent ?? "";
  // 简单把 HTML 转成可读文本/markdown 近似
  const body = String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
  return {
    id: `ruoyi-notice-${n.noticeId}`,
    title: n.noticeTitle || "通知",
    body_markdown: body || n.remark || "",
    type: n.noticeType === "2" ? "notice" : "notice",
    priority: "normal",
    source: "ruoyi",
    received_at: n.createTime,
    read_at: n.isRead ? (n.createTime || new Date().toISOString()) : null,
    dismissed_at: null,
    raw: {
      noticeId: n.noticeId,
      noticeType: n.noticeType,
      noticeContent: html,
      createBy: n.createBy,
    },
  };
}
