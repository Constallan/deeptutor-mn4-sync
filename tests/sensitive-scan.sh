#!/usr/bin/env bash
# 敏感信息扫描：全仓文本文件。
#
# 扫描对象：仓库内全部 *.md、*.js、*.json、*.sh、.gitignore，以及 LICENSE。
# 排除：.git/、dist/（二进制打包产物）、本脚本自身
#       （本脚本的内部字面量即为检查模式与白名单定义，故不自扫）。
#
# 白名单（仅 main.js，其余文件对全部模式零命中）：
#   1. 注释分隔线：整行仅 "//" + 横线
#   2. base64 字符表：含大写字母表前缀字面量的一行
#   3. 两个 ObjC 桥接方法名：长异步请求桥名、文本输入弹窗桥名
#   4. 凭据格式文案：含 "id:token" / "Device ID : Token" /
#      "device_id:token" 三种短语之一的行
#
# constallan（忽略大小写匹配）仅允许：
#   - mnaddon.json 的 "author" 字段值
#   - 文档中 GitHub 链接字面量 github.com/Constallan/ 内的 Constallan
#
# 大小写说明：constallan 与 token 两个模式按忽略大小写匹配；
# 其余模式（路径 / 内网地址 / 凭据前缀 / 长 ASCII 串）区分大小写。

set -u
cd "$(dirname "$0")/.." || exit 1

files=$(find . -type f \
  \( -name '*.md' -o -name '*.js' -o -name '*.json' -o -name '*.sh' \
     -o -name '.gitignore' -o -name 'LICENSE' \) \
  ! -path './.git/*' ! -path './dist/*' \
  ! -path './tests/sensitive-scan.sh' | sort)

RE_HARD='[/]vol1/|192[.]168|100[.]7[3]|100[.][0-9]{2,3}[.]|gh[o]_'
RE_LONG='[A-Za-z0-9_=-]{32,}'
RE_CONSTALLAN='[c]onstallan'
RE_TOKEN='[t]oken'

SEP_RULE='^[[:space:]]*// -+[[:space:]]*$'
B64_RULE='ABCDEFGHIJKLMNOPQRSTUVWXYZ'
M1_RULE='sendAsynchronous''RequestQueueCompletionHandler'
M2_RULE='showWithTitleMessageStyleCancel''ButtonTitleOther''ButtonTitlesTapBlock'
T1_RULE='id:''token'
T2_RULE='Device ID : ''Token'
T3_RULE='device_id:''token'

fail=0
mainjs_ok=0
constallan_ok=0

echo "扫描文件："
echo "$files" | sed 's/^/  /'

for f in $files; do
  # 1) 硬禁止模式：路径 / 内网地址 / 凭据前缀 —— 任何文件任何行不得命中
  hits=$(grep -nE "$RE_HARD" "$f" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    fail=1
    echo "FAIL  $f  硬禁止模式命中:"
    echo "$hits" | sed 's/^/      /'
  fi

  if [ "$f" = "./main.js" ]; then
    # 2) main.js：长串命中需落在白名单 1/2/3
    while IFS= read -r line; do
      text="${line#*:}"
      if echo "$text" | grep -qE "$SEP_RULE" || \
         echo "$text" | grep -qF "$B64_RULE" || \
         echo "$text" | grep -qF "$M1_RULE" || \
         echo "$text" | grep -qF "$M2_RULE"; then
        mainjs_ok=$((mainjs_ok + 1))
      else
        fail=1
        echo "FAIL  $f  长串命中但不在白名单: $line"
      fi
    done < <(grep -nE "$RE_LONG" "$f" 2>/dev/null || true)

    # 3) main.js：token 命中需落在白名单 4 的三种短语
    while IFS= read -r line; do
      text="${line#*:}"
      if echo "$text" | grep -qF "$T1_RULE" || \
         echo "$text" | grep -qF "$T2_RULE" || \
         echo "$text" | grep -qF "$T3_RULE"; then
        mainjs_ok=$((mainjs_ok + 1))
      else
        fail=1
        echo "FAIL  $f  token 命中但不在白名单: $line"
      fi
    done < <(grep -niE "$RE_TOKEN" "$f" 2>/dev/null || true)
  else
    # 4) 非 main.js：长串与 token 零命中
    hits=$(grep -nE "$RE_LONG" "$f" 2>/dev/null || true)
    if [ -n "$hits" ]; then
      fail=1
      echo "FAIL  $f  长串命中（非 main.js 不允许）:"
      echo "$hits" | sed 's/^/      /'
    fi
    hits=$(grep -niE "$RE_TOKEN" "$f" 2>/dev/null || true)
    if [ -n "$hits" ]; then
      fail=1
      echo "FAIL  $f  token 命中（非 main.js 不允许）:"
      echo "$hits" | sed 's/^/      /'
    fi
  fi

  # 5) constallan（忽略大小写）：仅两处允许位置
  while IFS= read -r line; do
    text="${line#*:}"
    allowed=0
    if [ "$f" = "./mnaddon.json" ] && \
       echo "$text" | grep -qF '"author"' && \
       echo "$text" | grep -qiE "$RE_CONSTALLAN"; then
      allowed=1
    fi
    if [ "${f##*.}" = "md" ] && \
       echo "$text" | grep -qF 'github.com/Constallan/'; then
      allowed=1
    fi
    if [ "$allowed" -ne 1 ]; then
      fail=1
      echo "FAIL  $f  constallan 命中但不在允许位置: $line"
    else
      constallan_ok=$((constallan_ok + 1))
    fi
  done < <(grep -niE "$RE_CONSTALLAN" "$f" 2>/dev/null || true)
done

if [ "$fail" -eq 0 ]; then
  echo "PASS: 全仓敏感扫描通过（main.js 白名单命中 $mainjs_ok 处，"
  echo "      constallan 允许位置 $constallan_ok 处，其余文件零命中）"
  exit 0
else
  echo "FAIL: 存在白名单之外的命中，详见上方"
  exit 1
fi
