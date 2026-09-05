<!-- 建议标题（发起时使用）：
[Question] 官方 MN4 add-on 是否有公开下载渠道？社区独立实现可作参考 -->

## 背景

我为 DeepTutor 官方的 MarginNote 4 桥实现了一个独立开源的 MN4 客户端
插件：https://github.com/Constallan/deeptutor-mn4-sync
（仓库公开后链接生效）。

## 现状

DeepTutor v1.5.16 的发布说明提到 MarginNote 4 知识库由其自带 add-on
填充（服务器桥由社区贡献并已合入），但截至撰写本 issue 时，我未检索到
该官方 add-on 的公开下载渠道。社区此前可用的第三方插件停留在 MN3 时代，
无法在 MarginNote 4 中启用。因此我依据服务端桥接口
（/api/marginnote4/*）自行实现了 MN4 客户端。

## 本插件概况

- 单文件、无依赖的 MN4 原生扩展（JSB.newAddon 官方契约入口）。
- 功能：配置向导（Server URL / KB Name / Device ID 与一次性配对凭据）、
  60 秒自动增量同步、心跳、工具栏菜单（立即同步 / 停用 / 重置）。
- 实测范围：MarginNote 4.4.6 (macOS) + 自托管 DeepTutor v1.5.16+，
  同步 20,434 条对象（2 万+）入库；其他平台未测试。
- 状态：未签名（用户需在 MN4 设置中开启「允许加载未经认证的插件」）。

## 请求

1. 官方是否计划公开官方 add-on 的下载渠道？如已公开，烦请指路。
2. 是否愿意在文档或发布说明中参考、链接本仓库？
3. 或者，本插件是否可申请官方签名上架？

谢谢！
