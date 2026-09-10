# 架构：DeepTutor Sync (MarginNote 4 add-on)

## 总览

单文件、无依赖的 ES5 脚本，运行在 MarginNote 4 内置的 JSCore 环境。
入口遵循 MN4 官方扩展契约：`JSB.newAddon` 工厂返回 `JSB.defineClass`
定义的单例扩展类。

## 模块划分（main.js 内部分区）

| 分区 | 职责 |
| --- | --- |
| Utils | 设置读写、HUD 提示、base64 解码 |
| Network | `dtFetch`：NSURLConnection 桥接的 Promise 化请求 |
| Dialogs | UIAlertView 桥接的按钮弹窗 / 文本输入弹窗 |
| Sync engine | 对象收集（note / card / mindmap_node / document）、批量 POST、心跳 |
| Timers | NSTimer 驱动的 60 秒心跳与 15 分钟扫描调度，分片让出、防重入 |
| Configure flow | 三步配置向导 + 连接测试 |
| Addon entry | 场景生命周期挂钩与工具栏菜单 |

## 关键设计

- 持久化：`NSUserDefaults` 存单键配置对象（服务器地址 / 库名 / 凭据 /
  启停状态 / 上次同步结果）。
- 请求层：NSURLConnection 的异步接口桥接为 Promise；超时 15 秒；
  请求头 `Content-Type` / `Accept` 为 JSON。
- 形状无关响应解析：MN4 4.1.x 与 4.4.6 的回调数据形态不同（NSData、
  已解析对象、字符串、HTTP 元对象、NSError），解析器逐参分类：
  优先取带 `base64Encoding` 的 NSData，其次识别桥接口业务字段
  （stored / updated / deleted / object_count / device_id），
  对无法识别的形态按失败处理并保留原始信息，绝不静默吞掉。
- 同步引擎：逐学习集缓存关系与文档字段，状态机分片转换笔记、链接及文档。
  每片目标 8 ms，最多 25 步，使用 0.01 秒一次性 NSTimer 让出；单次原生调用无法抢占。
  收到 500 条立即串行推送，响应后继续收集；不保留整库导出数组。
  服务端按 object_id 去重更新，客户端仍是全量扫描，不是真正的源端增量查询。
  请求失败继续剩余批次，最终记录 lastError；收集异常中止并记录，周期仍会重试。
- 定时循环：首次启用或重连启动扫描，此后扫描完成/失败后等待 15 分钟；
  独立心跳响应后等待 60 秒。`_activeSync` 防重入，代际编号隔离过期回调。
  停用、重置、重配和场景断开会取消收集并失效定时器；已发送请求可能完成，
  但不得更新状态或触发后续批次。重连可以立即启动新代际。

## 与 DeepTutor MN4 桥的对接协议

服务端（v1.5.16 起由社区贡献并已合入）暴露以下端点，前缀
`/api/marginnote4`：

| 端点 | 方法 | 鉴权 | 用途 |
| --- | --- | --- | --- |
| /pair | POST | 会话登录 | 生成 device_id 与一次性凭据 |
| /devices | GET | 会话登录 | 列出已配对设备 |
| /devices/{id} | DELETE | 会话登录 | 撤销设备 |
| /status | GET | 会话登录 | 连接状态 |
| /sync | POST | 设备凭据 | 增量推送对象 |
| /heartbeat | POST | 设备凭据 | 心跳 |

设备凭据鉴权：请求头 `Authorization: MarginNote <device_id>:<凭据>`，
另带 `X-MN4-KB` 头选择目标知识库（仅作选择器，不授予权限）。

sync 请求体：`{ cursor, objects[], deleted_ids[] }`；对象字段：
object_id / object_type / title / content / excerpt / document_id /
document_title / page / tags / links / color / created_at /
updated_at / raw。

sync 响应含 stored / updated / deleted / object_count 等计数；
heartbeat 响应含 `object_count`、`device_id`。

配对流程：DeepTutor 知识中心 → 创建或连接 MarginNote 4 库 →
Devices 页 Pair → 把一次性凭据粘贴进插件配置向导。

## 兼容性说明

- 已实测：MarginNote 4.4.6 (macOS) + 自托管 DeepTutor v1.5.16+。
- `mnaddon.json` 声明 `marginnote_version_min: 3.7.21`（MN4 扩展契约
  的最低版本）；未在 3.x / 4.0 / 4.1 实测。
- 4.1.x 与 4.4.x 的回调数据形态差异由形状无关解析器兼容。
- 未签名（`cert_key` 为空）：需在 MN4 设置开启
  「允许加载未经认证的插件」。
- 其他平台（如 iPadOS）未测试。
