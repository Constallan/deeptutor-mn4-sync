# DeepTutor Sync — MarginNote 4 add-on

DeepTutor 官方 MarginNote 4 桥的独立开源客户端插件：把 MarginNote 4 的
笔记、摘录、卡片、思维导图节点与文档增量推送到自托管的 DeepTutor 实例，
作为 DeepTutor 的 MarginNote 4 知识库使用。

## 功能

- 配置向导：Server URL / Knowledge Base Name / Device ID 与一次性配对凭据
- 60 秒自动增量同步（NSTimer 驱动，单一全局循环，防重入）
- 心跳上报与连接测试
- 工具栏菜单：Configure / Sync Now / Disable / Reset
- 场景断开自动停止，重连自动恢复

## 安装与配对

1. 获取 `dist/deeptutor-mn4-sync-1.1.2.mnaddon`，在 MarginNote 4 中打开
   （或拖入）完成安装。
2. 本插件未签名（`mnaddon.json` 的 `cert_key` 为空），首次使用需在
   MarginNote 4 设置中开启「允许加载未经认证的插件」。
3. 在 DeepTutor 知识中心创建或连接 MarginNote 4 知识库，进入该库的
   Devices 页点 Pair，得到一次性配对凭据（device_id:凭据 格式）。
4. 点击工具栏的 DeepTutor Sync 图标 → Configure / 配置，依次填入：
   服务器地址、库名（须与 DeepTutor 中完全一致）、凭据（完整粘贴）。
   保存后自动测试连接，成功后立即开始首次同步并进入 60 秒循环。

## 兼容性（如实声明）

- 已实测：MarginNote 4.4.6 (macOS) + 自托管 DeepTutor v1.5.16+，
  20,434 条对象成功入库。
- 其他 MarginNote 版本、其他平台（如 iPadOS）未测试。
- 依赖 DeepTutor 服务端的 `/api/marginnote4/*` 桥接口（v1.5.16 起
  由社区贡献并已合入）。

## 架构一句话

MN4 官方契约入口（`JSB.newAddon` 工厂），`NSUserDefaults` 持久化配置，
`NSURLConnection` 发起请求，形状无关的响应解析（兼容 4.1.x 的 NSData
形态与 4.4.x 的解析对象形态）。详见 `docs/ARCHITECTURE.md`。

## License 与致谢

- 作者：Constallan（https://github.com/Constallan/）
- 许可：MIT，见 `LICENSE`。
- 代码来源与致谢声明：见 `docs/ATTRIBUTION.md`。
- 仓库：https://github.com/Constallan/deeptutor-mn4-sync

## 本地检查

```bash
node --check main.js          # 语法检查
node tests/syntax-check.js    # 同上（new Function 解析，PASS/FAIL）
tests/sensitive-scan.sh       # 敏感信息扫描（全仓文本文件）
```
