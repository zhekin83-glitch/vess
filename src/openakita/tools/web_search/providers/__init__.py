"""Built-in web_search providers.

Each module in this package registers itself on import:

    bocha       — 博查（国内推荐，需要 BOCHA_API_KEY）
    bing        — 必应中文 RSS（无 Key；国内开箱默认，直连可用）
    tavily      — Tavily（海外推荐，需要 TAVILY_API_KEY）
    searxng     — 自部署 SearXNG（需要 SEARXNG_BASE_URL）
    jina        — Jina Reader（无 Key 免费额度；海外可用，国内常不可达）
    duckduckgo  — DuckDuckGo（无 Key；仅显式选中时启用，国内常不可达）

To add a new provider: drop ``providers/<id>.py`` with a module-level
``register(YourProvider())`` call, then add the import in ``registry._ensure_loaded``.
"""

from __future__ import annotations
