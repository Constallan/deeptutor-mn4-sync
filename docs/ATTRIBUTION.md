# Attribution / 致谢声明

本插件为独立实现。以下项目对其设计与实现有影响，如实声明如下。

## 代码模式参考（有沿用）

- **OhMyMN**（MIT License, © 2021 Ou Rongxing）
  - 参考内容：MN 插件中 UIAlertView 弹窗桥接与网络请求桥接的整体
    模式（对应 `main.js` 的 Dialogs / Network 分区）。
  - 本插件代码为独立编写，无逐行复制；上述模式属通用桥接写法。

## 分析参考（无代码沿用）

- **evan188199-tech/mn4-deeptutor-sync**（MIT License, © 2026 Feliks）
  - 仅分析其思路与取舍（MN4 同步方向、字段映射），未沿用任何代码。
- **AddonLib**（MIT License, © 2026 Feliks）
  - 仅分析其工程化结构，未沿用任何代码。

## 其他

- DeepTutor 服务端 MN4 桥接口契约来自 HKUDS/DeepTutor 上游代码；
  本插件为独立客户端实现，不含上游代码。
