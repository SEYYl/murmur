"""S3 启用后的回归测试 — 验证本地模式不受影响 + 新端点可用。"""
import urllib.request
import urllib.error
import json

BASE = "http://127.0.0.1:8000"


def req(method, path, data=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(f"{BASE}{path}", data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def main():
    print("=== S3 启用改造回归测试 ===\n")

    # 1. 登录
    s, b = req("POST", "/api/login", {"username": "admin", "password": "admin123"})
    token = json.loads(b).get("token") if s == 200 else None
    has_token = "yes" if token else "no"
    print(f"[1] 登录: {s} token={has_token}")
    assert s == 200, "登录失败"

    # 2. 存储状态端点（新增）
    s, b = req("GET", "/api/admin/storage/status", token=token)
    data = json.loads(b)
    print(f"[2] 存储状态: {s} backend={data.get('backend')} counts={data.get('local_counts')}")
    assert s == 200, "存储状态端点失败"
    assert data.get("backend") == "local", "默认应为 local"

    # 3. 迁移端点（本地模式应返回 400）
    s, b = req("POST", "/api/admin/storage/migrate", token=token)
    print(f"[3] 迁移(local应400): {s} body={b.decode()[:100]}")
    assert s == 400, "本地模式迁移应拒绝"

    # 4. 内容列表
    s, b = req("GET", "/api/posts?page=1&page_size=5")
    data = json.loads(b)
    total = data.get("total", 0)
    items = data.get("items", [])
    print(f"[4] 内容列表: {s} total={total} items={len(items)}")
    assert s == 200, "内容列表失败"

    # 5. 内容详情
    if items:
        pid = items[0]["id"]
        s, b = req("GET", f"/api/posts/{pid}")
        p = json.loads(b)
        fp = p.get("file_path", "")
        print(f"[5] 详情 id={pid}: {s} status={p.get('status')} file_path={fp[:50]}")
        assert s == 200, "详情失败"

        # 6. 媒体访问
        if fp:
            s2, _ = req("GET", f"/{fp}")
            print(f"[6] 媒体访问: HTTP {s2}")
            assert s2 == 200, f"媒体访问失败: {s2}"

    # 7. 分类列表
    s, b = req("GET", "/api/categories")
    cats = json.loads(b)
    print(f"[7] 分类: {s} count={len(cats)}")
    assert s == 200, "分类失败"

    # 8. RSS
    s, b = req("GET", "/rss")
    print(f"[8] RSS: {s} len={len(b)} bytes")
    assert s == 200, "RSS 失败"

    # 9. 转码状态
    s, b = req("GET", "/api/admin/transcode/status", token=token)
    print(f"[9] 转码状态: {s} {b.decode()[:100]}")
    assert s == 200, "转码状态失败"

    # 10. 收藏列表（鉴权 + 存储无关）
    s, b = req("GET", "/api/me/favorites?page=1", token=token)
    print(f"[10] 收藏列表: {s}")
    assert s == 200, "收藏列表失败"

    # 11. 字幕列表
    if items:
        pid = items[0]["id"]
        s, b = req("GET", f"/api/posts/{pid}/subtitles")
        print(f"[11] 字幕列表: {s}")
        assert s == 200, "字幕列表失败"

    print("\n=== 所有测试通过 ===")


if __name__ == "__main__":
    main()
