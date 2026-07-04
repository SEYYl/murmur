"""Murmur 性能压测脚本

测试核心 API 的响应时间、吞吐量和并发能力。
使用标准库 urllib + concurrent.futures，无需额外依赖。

用法: python scripts/benchmark.py
"""

import json
import time
import statistics
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict

BASE_URL = "http://127.0.0.1:8000"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


def _req(method, path, data=None, token=None, headers=None):
    url = f"{BASE_URL}{path}"
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    if headers:
        h.update(headers)
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=h, method=method)
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp_body = resp.read()
            elapsed = time.perf_counter() - start
            return resp.status, elapsed, resp_body
    except urllib.error.HTTPError as e:
        elapsed = time.perf_counter() - start
        return e.code, elapsed, e.read()


def login(username, password):
    data = {"username": username, "password": password}
    status, _, body = _req("POST", "/api/login", data)
    if status == 200:
        return json.loads(body).get("token")
    return None


class Benchmark:
    def __init__(self):
        self.results = defaultdict(list)
        self.token = None

    def run(self, name, fn, concurrency=10, iterations=100):
        """运行并发压测，记录每次请求的耗时"""
        latencies = []
        errors = 0
        start = time.perf_counter()

        with ThreadPoolExecutor(max_workers=concurrency) as pool:
            futures = [pool.submit(fn) for _ in range(iterations)]
            for fut in as_completed(futures):
                try:
                    status, elapsed = fut.result()
                    latencies.append(elapsed)
                    if status >= 400:
                        errors += 1
                except Exception:
                    errors += 1

        total_time = time.perf_counter() - start
        latencies.sort()
        n = len(latencies)

        result = {
            "name": name,
            "concurrency": concurrency,
            "iterations": iterations,
            "total_time_s": round(total_time, 3),
            "qps": round(n / total_time, 1) if total_time > 0 else 0,
            "avg_ms": round(statistics.mean(latencies) * 1000, 2) if latencies else 0,
            "p50_ms": round(latencies[n // 2] * 1000, 2) if latencies else 0,
            "p95_ms": round(latencies[int(n * 0.95)] * 1000, 2) if latencies else 0,
            "p99_ms": round(latencies[int(n * 0.99)] * 1000, 2) if latencies else 0,
            "min_ms": round(latencies[0] * 1000, 2) if latencies else 0,
            "max_ms": round(latencies[-1] * 1000, 2) if latencies else 0,
            "errors": errors,
        }
        self.results[name] = result
        return result

    def print_result(self, r):
        print(f"\n{'='*60}")
        print(f"  {r['name']}")
        print(f"  并发: {r['concurrency']}  请求数: {r['iterations']}  总耗时: {r['total_time_s']}s")
        print(f"  QPS: {r['qps']}  错误数: {r['errors']}")
        print(f"  平均: {r['avg_ms']}ms  P50: {r['p50_ms']}ms  P95: {r['p95_ms']}ms  P99: {r['p99_ms']}ms")
        print(f"  最小: {r['min_ms']}ms  最大: {r['max_ms']}ms")
        print(f"{'='*60}")

    def print_summary_table(self):
        print("\n")
        print("=" * 90)
        print(f"{'接口':<35} {'并发':>4} {'QPS':>8} {'平均(ms)':>10} {'P50(ms)':>10} {'P95(ms)':>10} {'P99(ms)':>10}")
        print("-" * 90)
        for name, r in self.results.items():
            print(f"{name:<35} {r['concurrency']:>4} {r['qps']:>8.1f} {r['avg_ms']:>10.2f} {r['p50_ms']:>10.2f} {r['p95_ms']:>10.2f} {r['p99_ms']:>10.2f}")
        print("=" * 90)

    def print_markdown_table(self):
        """生成 Markdown 格式的结果表，方便粘贴到 README"""
        print("\n### API 压测结果\n")
        print("| 接口 | 并发 | QPS | 平均(ms) | P50(ms) | P95(ms) | P99(ms) |")
        print("|------|------|-----|----------|---------|---------|---------|")
        for name, r in self.results.items():
            print(f"| {name} | {r['concurrency']} | {r['qps']} | {r['avg_ms']} | {r['p50_ms']} | {r['p95_ms']} | {r['p99_ms']} |")


def main():
    print("Murmur 性能压测")
    print(f"目标: {BASE_URL}")
    print("登录中...")

    bench = Benchmark()
    bench.token = login(ADMIN_USER, ADMIN_PASS)
    if not bench.token:
        print("登录失败，退出")
        return
    print("登录成功 ✓\n")

    # ─── 1. 分类列表（最简单的读接口）───
    def test_categories():
        status, elapsed = _req("GET", "/api/categories")[:2]
        return status, elapsed

    bench.print_result(bench.run("GET /api/categories", test_categories, concurrency=10, iterations=200))

    # ─── 2. 内容列表（带 DB 查询 + 序列化）───
    def test_posts():
        status, elapsed = _req("GET", "/api/posts?page=1&page_size=20")[:2]
        return status, elapsed

    bench.print_result(bench.run("GET /api/posts (列表20条)", test_posts, concurrency=10, iterations=200))

    # ─── 3. 内容详情（带计数查询 +1 播放量）───
    def test_post_detail():
        status, elapsed = _req("GET", "/api/posts/1")[:2]
        return status, elapsed

    bench.print_result(bench.run("GET /api/posts/1 (详情)", test_post_detail, concurrency=10, iterations=200))

    # ─── 4. 登录（带密码哈希）───
    def test_login():
        data = {"username": "admin", "password": "admin123"}
        status, elapsed = _req("POST", "/api/login", data)[:2]
        return status, elapsed

    bench.print_result(bench.run("POST /api/login", test_login, concurrency=10, iterations=100))

    # ─── 5. 收藏列表（带鉴权 + 关联查询）───
    token = bench.token

    def test_favorites():
        status, elapsed = _req("GET", "/api/me/favorites?page=1", token=token)[:2]
        return status, elapsed

    bench.print_result(bench.run("GET /api/me/favorites", test_favorites, concurrency=10, iterations=100))

    # ─── 6. 收藏切换（写操作）───
    def test_favorite_toggle():
        status, elapsed = _req("POST", "/api/posts/1/favorite", token=token)[:2]
        return status, elapsed

    bench.print_result(bench.run("POST /api/posts/1/favorite", test_favorite_toggle, concurrency=10, iterations=100))

    # ─── 7. 搜索 ───
    def test_search():
        status, elapsed = _req("GET", "/api/posts?search=test&page=1")[:2]
        return status, elapsed

    bench.print_result(bench.run("GET /api/posts?search=test", test_search, concurrency=10, iterations=100))

    # ─── 8. 管理面板统计（多查询聚合）───
    def test_admin_stats():
        status, elapsed = _req("GET", "/api/admin/stats?range=7d", token=token)[:2]
        return status, elapsed

    bench.print_result(bench.run("GET /api/admin/stats", test_admin_stats, concurrency=5, iterations=50))

    # ─── 9. 媒体文件流式传输（小文件）───
    def test_media_small():
        status, elapsed = _req("GET", "/media/covers/default.jpg")[:2]
        return status, elapsed

    try:
        bench.print_result(bench.run("GET /media/covers (封面图)", test_media_small, concurrency=10, iterations=100))
    except Exception:
        print("跳过封面图测试（文件可能不存在）")

    # ─── 10. RSS Feed ───
    def test_rss():
        status, elapsed = _req("GET", "/rss")[:2]
        return status, elapsed

    bench.print_result(bench.run("GET /rss", test_rss, concurrency=10, iterations=100))

    # ─── 高并发压测 ───
    print("\n" + "=" * 60)
    print("  高并发压测 (50 并发)")
    print("=" * 60)

    bench.print_result(bench.run("GET /api/posts (50并发)", test_posts, concurrency=50, iterations=500))
    bench.print_result(bench.run("GET /api/categories (50并发)", test_categories, concurrency=50, iterations=500))

    # ─── 总结 ───
    bench.print_summary_table()
    bench.print_markdown_table()


if __name__ == "__main__":
    main()
