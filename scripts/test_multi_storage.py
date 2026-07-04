"""多存储 provider 测试 — 验证 presets、连通性测试、设置保存"""
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
    s, b = req("POST", "/api/login", {"username": "admin", "password": "admin123"})
    token = json.loads(b)["token"]
    print(f"[1] 登录: {s}")

    # 1. 存储状态 + provider 字段 + presets
    s, b = req("GET", "/api/admin/storage/status", token=token)
    d = json.loads(b)
    print(f"[2] 存储状态: {s} backend={d['backend']} provider={d['provider']} presets={len(d.get('presets',{}))}")
    presets = d.get("presets", {})
    assert "aws" in presets, "缺少 aws preset"
    assert "aliyun" in presets, "缺少 aliyun preset"
    assert "minio" in presets, "缺少 minio preset"
    assert "custom" in presets, "缺少 custom preset"
    for k, v in presets.items():
        print(f"    {k}: {v['label']}  path_style={v['path_style']}  region_required={v['region_required']}")

    # 2. 本地模式连通性测试
    s, b = req("POST", "/api/admin/storage/test", token=token)
    d = json.loads(b)
    print(f"[3] 本地测试: ok={d['ok']} total_bytes={d.get('details',{}).get('total_bytes')}")
    assert d["ok"] is True

    # 3. 保存 storage_provider 设置（minio）
    s, b = req("PUT", "/api/admin/settings", {"storage_provider": "minio"}, token=token)
    print(f"[4] 保存设置 storage_provider=minio: {s}")
    assert s == 200

    # 4. 重新读取设置验证
    s, b = req("GET", "/api/admin/settings", token=token)
    d = json.loads(b)
    print(f"[5] 重新读取: storage_provider={d.get('storage_provider')}")
    assert d.get("storage_provider") == "minio"

    # 5. 保存 s3_region 设置
    s, b = req("PUT", "/api/admin/settings", {"s3_region": "us-east-1"}, token=token)
    print(f"[6] 保存 s3_region: {s}")
    assert s == 200

    # 6. 重新读取
    s, b = req("GET", "/api/admin/settings", token=token)
    d = json.loads(b)
    print(f"[7] 重新读取: s3_region={d.get('s3_region')}")
    assert d.get("s3_region") == "us-east-1"

    # 恢复默认
    req("PUT", "/api/admin/settings", {"storage_provider": "custom", "s3_region": ""}, token=token)

    # 7. 内容列表（确认存储改造不影响列表）
    s, b = req("GET", "/api/posts?page=1&page_size=5")
    data = json.loads(b)
    print(f"[8] 内容列表: {s} total={data['total']}")
    assert s == 200

    print()
    print("=== 全部测试通过 ===")


if __name__ == "__main__":
    main()
