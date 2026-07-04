import urllib.request
import urllib.parse
import json
import os
import sys
import uuid
import shutil
import random
import struct
import wave
import math

BASE_URL = os.environ.get("API_BASE_URL", "https://murmur-wnk8.onrender.com").rstrip("/")
ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
MEDIA_DIR = os.path.join(ROOT_DIR, "media", "audio")
TEST_DIR = os.path.join(ROOT_DIR, "test_content")
TEMP_DIR = os.path.join(ROOT_DIR, "temp_audio")
SAMPLE_DIR = os.path.join(ROOT_DIR, "sample_audio")

CATEGORY_POSTS = {
    "耳语": [
        {"title": "轻柔耳语 · 睡前故事", "desc": "温柔的声音在耳边低语，带你进入甜美的梦乡"},
        {"title": "清晨呢喃 · 呼吸声", "desc": "近距离的呼吸声与轻柔的耳语，极度放松"},
    ],
    "触发音": [
        {"title": "指尖敲击 · 木质桌面", "desc": "缓慢而有节奏的敲击声，经典触发音"},
        {"title": "纸张翻动 · 书页沙沙", "desc": "轻轻翻动书页的声音，舒缓治愈"},
    ],
    "角色扮演": [
        {"title": "理发店 · 温柔剪发", "desc": "剪刀声与轻声细语，经典角色扮演"},
        {"title": "眼部护理 · 放松SPA", "desc": "模拟专业眼部护理，让眼睛得到休息"},
    ],
    "白噪音": [
        {"title": "绵绵细雨 · 窗边听雨", "desc": "窗外淅淅沥沥的雨声，最适合入眠"},
        {"title": "海浪轻拍 · 海边漫步", "desc": "有节奏的海浪声，仿佛置身海边"},
    ],
    "咀嚼音": [
        {"title": "酥脆零食 · 轻咬声", "desc": "酥脆的零食咀嚼声，令人满足的触发音"},
        {"title": "冰块碰撞 · 清凉夏日", "desc": "玻璃杯中的冰块碰撞声，清爽治愈"},
    ],
    "冥想": [
        {"title": "深度冥想 · 钵音疗愈", "desc": "藏钵的悠远共鸣，带你进入深度冥想"},
        {"title": "呼吸引导 · 478呼吸法", "desc": "跟着引导呼吸，快速放松身心"},
    ],
    "纯音乐": [
        {"title": "钢琴独奏 · 夜的旋律", "desc": "温柔的钢琴曲，伴你度过安静夜晚"},
        {"title": "自然长笛 · 森林深处", "desc": "悠扬的笛声与自然声，治愈心灵"},
    ],
    "综合": [
        {"title": "森林清晨 · 鸟鸣流水", "desc": "大自然的声音合集，鸟语花香"},
        {"title": "深夜咖啡馆 · 白噪音", "desc": "咖啡馆的环境音，专注与放松兼得"},
    ],
}


def api_get(path, token=None):
    req = urllib.request.Request(f"{BASE_URL}{path}")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def api_post(path, data, token=None, is_form=False):
    if is_form:
        body = urllib.parse.urlencode(data).encode()
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
    else:
        body = json.dumps(data).encode()
        headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE_URL}{path}", data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"  Error {e.code}: {e.read().decode()}")
        raise

def api_delete(path, token):
    req = urllib.request.Request(f"{BASE_URL}{path}", headers={"Authorization": f"Bearer {token}"}, method="DELETE")
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"  Error {e.code}: {e.read().decode()}")
        raise

def upload_post(file_path, fields, token):
    boundary = uuid.uuid4().hex
    body = b""
    for k, v in fields.items():
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    fname = os.path.basename(file_path)
    ext = os.path.splitext(fname)[1].lower()
    mime = "audio/wav" if ext == ".wav" else "audio/mpeg"
    with open(file_path, "rb") as f:
        file_data = f.read()
    body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{fname}\"\r\nContent-Type: {mime}\r\n\r\n".encode()
    body += file_data + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        f"{BASE_URL}/api/posts",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Authorization": f"Bearer {token}"
        },
        method="POST"
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


def generate_sine_wave(filename, freq=440, duration=30, sample_rate=44100, amplitude=0.3):
    """生成正弦波音频（用于冥想/纯音乐类）"""
    n_samples = int(duration * sample_rate)
    with wave.open(filename, 'w') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        for i in range(n_samples):
            t = i / sample_rate
            sample = math.sin(2 * math.pi * freq * t) * amplitude
            sample_bytes = struct.pack('<h', int(sample * 32767))
            wf.writeframes(sample_bytes)
            wf.writeframes(sample_bytes)

def generate_white_noise(filename, duration=30, sample_rate=44100, amplitude=0.15):
    """生成白噪音（用于白噪音/自然声类）"""
    n_samples = int(duration * sample_rate)
    with wave.open(filename, 'w') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        for i in range(n_samples):
            sample = (random.random() * 2 - 1) * amplitude
            sample_bytes = struct.pack('<h', int(sample * 32767))
            wf.writeframes(sample_bytes)
            wf.writeframes(sample_bytes)

def generate_brown_noise(filename, duration=30, sample_rate=44100, amplitude=0.1):
    """生成棕噪音（更深沉的噪音，适合耳语/冥想）"""
    n_samples = int(duration * sample_rate)
    with wave.open(filename, 'w') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        last = 0
        for i in range(n_samples):
            white = (random.random() * 2 - 1) * 0.2
            last = (last + 0.02 * white) / 1.02
            sample = last * amplitude * 10
            sample = max(-1, min(1, sample))
            sample_bytes = struct.pack('<h', int(sample * 32767))
            wf.writeframes(sample_bytes)
            wf.writeframes(sample_bytes)

def generate_tapping(filename, duration=30, sample_rate=44100):
    """生成敲击音（触发音类）"""
    n_samples = int(duration * sample_rate)
    with wave.open(filename, 'w') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        tap_interval = int(0.8 * sample_rate)
        for i in range(n_samples):
            sample = 0
            pos_in_tap = i % tap_interval
            if pos_in_tap < int(0.05 * sample_rate):
                t = pos_in_tap / sample_rate
                env = math.exp(-t * 80)
                freq = 800 + 400 * math.exp(-t * 50)
                sample = math.sin(2 * math.pi * freq * t) * env * 0.4
            sample_bytes = struct.pack('<h', int(sample * 32767))
            wf.writeframes(sample_bytes)
            wf.writeframes(sample_bytes)

def generate_binaural(filename, duration=30, sample_rate=44100, base_freq=200, beat_freq=6):
    """生成双耳节拍（冥想类）"""
    n_samples = int(duration * sample_rate)
    with wave.open(filename, 'w') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        for i in range(n_samples):
            t = i / sample_rate
            left = math.sin(2 * math.pi * base_freq * t) * 0.2
            right = math.sin(2 * math.pi * (base_freq + beat_freq) * t) * 0.2
            wf.writeframes(struct.pack('<h', int(left * 32767)))
            wf.writeframes(struct.pack('<h', int(right * 32767)))

def main():
    os.makedirs(TEMP_DIR, exist_ok=True)
    
    print(f"=== 目标服务器: {BASE_URL} ===")
    print("  Render 免费版可能休眠中，正在唤醒…")
    for attempt in range(5):
        try:
            req = urllib.request.Request(BASE_URL + "/api/categories")
            urllib.request.urlopen(req, timeout=30)
            break
        except Exception as e:
            print(f"  等待唤醒 ({attempt+1}/5): {e}")
            import time
            time.sleep(5)
    print("  服务器已就绪\n")
    
    admin_user = os.environ.get("ADMIN_USER", "admin")
    admin_pass = os.environ.get("ADMIN_PASS", "admin123")
    print("=== Step 1: 登录管理员 ===")
    try:
        r = api_post("/api/login", {"username": admin_user, "password": admin_pass})
        token = r["token"]
        print(f"  登录成功: {r['user']['username']}")
    except Exception as e:
        print(f"  登录失败: {e}")
        print("  尝试注册管理员...")
        try:
            r = api_post("/api/register", {"username": admin_user, "password": admin_pass, "email": "admin@example.com"})
            token = r["token"]
            print(f"  注册成功: {r['user']['username']}")
        except Exception as e2:
            print(f"  注册也失败: {e2}")
            sys.exit(1)
    
    print("\n=== Step 2: 获取分类 ===")
    cats = api_get("/api/categories")
    cat_map = {c["name"]: c["id"] for c in cats}
    for c in cats:
        print(f"  {c['id']}. {c['name']} {c['icon']} - {c['post_count']}个内容")
    
    print("\n=== Step 3: 删除所有现有帖子 ===")
    all_posts = []
    page = 1
    while True:
        posts = api_get(f"/api/posts?page={page}", token=token)
        all_posts.extend(posts["items"])
        if page >= posts["total_pages"]:
            break
        page += 1
    print(f"  共 {len(all_posts)} 个帖子")
    for p in all_posts:
        print(f"  删除: {p['title']}")
        try:
            api_delete(f"/api/posts/{p['id']}", token)
        except Exception as e:
            print(f"    删除失败: {e}")
    
    print("\n=== Step 4: 准备 ASMR 音频文件 ===")

    audio_generators = {
        "耳语": [
            lambda p: generate_brown_noise(p, duration=25, amplitude=0.08),
            lambda p: generate_brown_noise(p, duration=20, amplitude=0.06),
        ],
        "触发音": [
            lambda p: generate_tapping(p, duration=20),
            lambda p: generate_white_noise(p, duration=25, amplitude=0.05),
        ],
        "角色扮演": [
            lambda p: generate_brown_noise(p, duration=30, amplitude=0.07),
            lambda p: generate_sine_wave(p, freq=300, duration=25, amplitude=0.1),
        ],
        "白噪音": [
            lambda p: generate_white_noise(p, duration=30, amplitude=0.12),
            lambda p: generate_brown_noise(p, duration=25, amplitude=0.1),
        ],
        "咀嚼音": [
            lambda p: generate_tapping(p, duration=15),
            lambda p: generate_white_noise(p, duration=20, amplitude=0.08),
        ],
        "冥想": [
            lambda p: generate_binaural(p, duration=30, base_freq=200, beat_freq=6),
            lambda p: generate_sine_wave(p, freq=432, duration=25, amplitude=0.15),
        ],
        "纯音乐": [
            lambda p: generate_sine_wave(p, freq=528, duration=30, amplitude=0.2),
            lambda p: generate_binaural(p, duration=25, base_freq=300, beat_freq=4),
        ],
        "综合": [
            lambda p: generate_white_noise(p, duration=20, amplitude=0.1),
            lambda p: generate_brown_noise(p, duration=30, amplitude=0.09),
        ],
    }

    sample_files = {}
    if os.path.isdir(SAMPLE_DIR):
        for f in os.listdir(SAMPLE_DIR):
            if f.endswith(('.mp3', '.wav', '.m4a')):
                sample_files[f] = os.path.join(SAMPLE_DIR, f)

    def _find_sample(cat_name, idx, title):
        for fname, fpath in sample_files.items():
            if fname.startswith(f"{cat_name}_{idx+1}_"):
                return fpath
        return None

    generated_files = {}
    idx = 0
    sample_count = 0
    gen_count = 0
    for cat_name, posts in CATEGORY_POSTS.items():
        generated_files[cat_name] = []
        for i, post_info in enumerate(posts):
            sample_path = _find_sample(cat_name, i, post_info["title"])
            if sample_path:
                ext = os.path.splitext(sample_path)[1]
                out_path = os.path.join(TEMP_DIR, f"asmr_{idx:03d}{ext}")
                shutil.copy2(sample_path, out_path)
                print(f"  使用示例 [{cat_name}] {post_info['title']} ({os.path.basename(sample_path)})")
                sample_count += 1
            else:
                wav_path = os.path.join(TEMP_DIR, f"asmr_{idx:03d}.wav")
                print(f"  生成 [{cat_name}] {post_info['title']}...")
                gen_func = audio_generators[cat_name][i % len(audio_generators[cat_name])]
                gen_func(wav_path)
                out_path = wav_path
                gen_count += 1
            generated_files[cat_name].append({"file": out_path, "info": post_info})
            idx += 1

    print(f"\n  共 {idx} 个音频文件 (示例: {sample_count}, 生成: {gen_count})")
    
    print("\n=== Step 5: 上传帖子到对应分类 ===")
    total = 0
    for cat_name, items in generated_files.items():
        cat_id = cat_map.get(cat_name)
        if not cat_id:
            print(f"  跳过未找到的分类: {cat_name}")
            continue
        for item in items:
            post_info = item["info"]
            file_path = item["file"]
            print(f"  上传 [{cat_name}] {post_info['title']}...")
            try:
                result = upload_post(
                    file_path,
                    {
                        "title": post_info["title"],
                        "description": post_info["desc"],
                        "category_id": str(cat_id),
                        "tags": "",
                    },
                    token
                )
                print(f"    成功! ID: {result.get('id', '?')}")
                total += 1
            except Exception as e:
                print(f"    失败: {e}")
    
    print(f"\n=== 完成! 共上传 {total} 个内容 ===")
    
    print("\n=== 分类内容统计 ===")
    cats = api_get("/api/categories")
    for c in cats:
        print(f"  {c['id']}. {c['name']} {c['icon']} - {c['post_count']}个内容")
    
    print("\n=== 清理临时文件 ===")
    shutil.rmtree(TEMP_DIR, ignore_errors=True)
    print("  完成")

if __name__ == "__main__":
    main()
