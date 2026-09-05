<!-- 建议标题（发起时使用）：
[Bug] 官方所指 MN4 add-on v0.1.0 为 MN3 契约且无法解析；附 MN4 原生实现参考 -->

## 背景

我为 DeepTutor 官方的 MarginNote 4 桥实现了一个独立开源的 MN4 客户端
插件：https://github.com/Constallan/deeptutor-mn4-sync
（仓库公开后链接生效）。

## 现状

DeepTutor v1.5.16 的发布说明提到 MarginNote 4 知识库由其自带 add-on
填充（服务器桥由社区贡献并已合入），但截至撰写本 issue 时，官方仓库
未提供 add-on 的下载渠道或安装文档，我亦未检索到面向 MN4 的官方插件。

我核查了桥贡献者仓库发布的 v0.1.0 包，发现它是 MN3 时代的老插件，
在 MN4 上不可用属结构性问题而非配置问题：

- main.js 采用 MN3 扩展契约：以 `JSB.require` 装载模块、以
  `JSB.newAddon(__dirname)` 挂载（main.js 第 23 行），无法作为
  MN4 插件加载；
- addon.js 第 155 行有一处多余的 `}`，整个文件无法通过语法解析；
- addon.js 第 191/222 行请求路径硬编码为 `/api/v1/marginnote4/...`，
  与 v1.5.16 实际挂载的 `/api/marginnote4/*` 不一致；
- manifest 的 marginnote_version_min 为 3.7.11（MN3 时代基线）。

因此我依据 v1.5.16 的桥接口自行实现了真正的 MN4 原生客户端。

## 本插件概况

- 单文件、无依赖的 MN4 原生扩展（JSB.newAddon 官方契约入口）。
- 功能：配置向导（Server URL / KB Name / Device ID 与一次性配对凭据）、
  60 秒自动增量同步、心跳、工具栏菜单（立即同步 / 停用 / 重置）。
- 实测范围：MarginNote 4.4.6 (macOS) + 自托管 DeepTutor v1.5.16+，
  同步 20,434 条对象（2 万+）入库；其他平台未测试。
- 状态：未签名（用户需在 MN4 设置中开启「允许加载未经认证的插件」）。

## 请求

1. 官方是否计划修复或公开真正的 MN4 原生 add-on？
2. 是否愿意参考、链接或收编本仓库的 MN4 原生实现？
3. 我可以把该实现以 PR 形式贡献给官方仓库（或桥贡献者的仓库）。
4. 或者，本插件是否可申请官方签名上架？

谢谢！
