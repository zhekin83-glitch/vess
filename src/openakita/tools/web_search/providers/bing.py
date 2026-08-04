"""Bing CN provider — 国内免 Key 默认源.

Uses the public RSS endpoint on ``cn.bing.com`` (``format=rss``). No API key,
works on mainland China networks where DuckDuckGo / Jina are often unreachable.
"""

from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from typing import Any
from urllib.parse import quote_plus

from ..base import NetworkUnreachableError, SearchResult
from ..registry import register
from ._http import describe_httpx_failure, search_httpx_client_kwargs

logger = logging.getLogger(__name__)


class BingProvider:
    id = "bing"
    label = "必应 Bing"
    requires_credential = False
    auto_detect_order = 12  # after bocha (with key), before jina
    signup_url = ""
    docs_url = "https://cn.bing.com/"

    _ENDPOINT = "https://cn.bing.com/search"

    def is_available(self) -> bool:
        return True

    async def search(
        self,
        query: str,
        *,
        max_results: int = 5,
        region: str = "wt-wt",
        safesearch: str = "moderate",
        timeout_seconds: float = 0.0,
    ) -> list[SearchResult]:
        del region, safesearch  # RSS endpoint has no equivalent knobs
        url = (
            f"{self._ENDPOINT}?q={quote_plus(query)}"
            f"&format=rss&setlang=zh-CN&cc=CN"
        )
        headers = {
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        }
        timeout = timeout_seconds if timeout_seconds and timeout_seconds > 0 else 20.0

        import httpx

        try:
            async with httpx.AsyncClient(
                **search_httpx_client_kwargs(timeout=timeout, target_url=url),
                follow_redirects=True,
            ) as client:
                resp = await client.get(url, headers=headers)
        except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as exc:
            raise NetworkUnreachableError(
                f"bing transport failure: {describe_httpx_failure(exc)}",
                provider_id=self.id,
            ) from exc
        except httpx.HTTPError as exc:
            raise NetworkUnreachableError(
                f"bing HTTP error: {describe_httpx_failure(exc)}",
                provider_id=self.id,
            ) from exc

        if resp.status_code >= 400:
            raise NetworkUnreachableError(
                f"bing HTTP {resp.status_code}: {resp.text[:200]}",
                provider_id=self.id,
            )

        try:
            root = ET.fromstring(resp.text)
        except ET.ParseError as exc:
            raise NetworkUnreachableError(
                "bing returned non-RSS response",
                provider_id=self.id,
            ) from exc

        out: list[SearchResult] = []
        for item in root.findall("./channel/item"):
            title = (item.findtext("title") or "").strip() or "无标题"
            link = (item.findtext("link") or "").strip()
            snippet = (item.findtext("description") or "").strip()
            date = (item.findtext("pubDate") or "").strip()
            if not link:
                continue
            out.append(
                SearchResult(
                    title=title,
                    url=link,
                    snippet=snippet,
                    source="bing",
                    date=date,
                )
            )
            if len(out) >= max_results:
                break
        return out

    async def news_search(
        self,
        query: str,
        *,
        max_results: int = 5,
        region: str = "wt-wt",
        safesearch: str = "moderate",
        timelimit: str | None = None,
        timeout_seconds: float = 0.0,
    ) -> list[SearchResult] | None:
        # RSS web results are good enough for "recent news" queries in CN.
        del timelimit
        return await self.search(
            query,
            max_results=max_results,
            region=region,
            safesearch=safesearch,
            timeout_seconds=timeout_seconds,
        )


register(BingProvider())
