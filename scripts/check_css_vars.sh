# CSS 变量完整性检查脚本
# 用法: bash scripts/check_css_vars.sh
# 检查 style.css 中使用的 CSS 变量是否都已定义

#!/bin/bash
CSS_FILE="frontend/css/style.css"

if [ ! -f "$CSS_FILE" ]; then
  echo "✗ 找不到 $CSS_FILE"
  exit 1
fi

# 提取所有使用的变量: var(--xxx) -> --xxx
USED=$(grep -oP 'var\(--[a-z0-9-]+' "$CSS_FILE" | sed 's/var(//' | sort -u)

# 提取所有定义的变量: --xxx: -> --xxx
DEFINED=$(grep -oP '^\s*--[a-z0-9-]+\s*:' "$CSS_FILE" | sed 's/[: ]//g' | sort -u)

# 找出使用但未定义的变量
MISSING=$(comm -23 <(echo "$USED") <(echo "$DEFINED"))

if [ -z "$MISSING" ]; then
  echo "✓ 所有 CSS 变量均已定义"
  exit 0
else
  echo "✗ 以下 CSS 变量被使用但未在 :root 中定义:"
  echo "$MISSING" | while read -r var; do
    COUNT=$(grep -c "var($var)" "$CSS_FILE")
    echo "  $var (使用 $COUNT 次)"
  done
  exit 1
fi
