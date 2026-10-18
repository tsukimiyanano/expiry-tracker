# expiry-tracker

物品过期管理应用：记录物品及过期日期，按分组与分类组织，帮助用户在物品过期前及时处理，减少浪费。

基于 Tauri 2 构建，当前主要面向 **Android 平台**。

## 技术栈

| 类别 | 技术 | 版本 | 用途 |
| --- | --- | --- | --- |
| 应用框架 | Tauri | 2.x | 应用壳与原生能力（当前目标平台为 Android） |
| 前端框架 | Vue | 3.5 | Composition API + `<script setup lang="ts">` |
| 语言 | TypeScript | 6.0（strict） | 前端类型安全 |
| 构建工具 | Vite | 8 | 开发服务器与构建 |
| 路由 | Vue Router | 5.4 | hash 历史、懒加载路由 |
| 状态管理 | Pinia | 4.0 | 已在 `main.ts` 注册，暂未创建 store |
| UI 组件库 | Vant | 4.10 | 移动端 UI 组件 |
| 原生层 | Rust | edition 2024 | Tauri 后端 |
| 目标平台 | Android | minSdk 24 / targetSdk 37 | 主要开发与运行平台 |

包管理器：**pnpm**。

### Tauri 官方插件

Rust 侧（`src-tauri/Cargo.toml` + `lib.rs`）与前端侧（`package.json`）均已安装：

- `@tauri-apps/plugin-fs` — 文件系统（应用数据持久化）
- `@tauri-apps/plugin-clipboard-manager` — 剪贴板
- `@tauri-apps/plugin-notification` — 本地通知
- `@tauri-apps/plugin-opener` — 打开外部 URL

## 主要功能

### 已实现

- 项目基础框架：路由（hash 历史、懒加载）、页面布局、安全区适配
- 页面骨架：首页（物品列表入口）、分类管理页
- 数据层：
  - 数据模型定义（`Category` / `ItemGroup` / `Item` / `AppData`）
  - AppData 结构与关联关系校验（`src/validators/`）
  - JSON 持久化 Repository：首次运行初始化、读取校验、串行保存；数据损坏时报错而不覆盖用户数据
- 开发测试页（仅 DEV 环境注册路由）：Tauri 原生插件验证（文件读写、剪贴板、通知、opener）

### 开发中

- 分类管理、物品管理的业务功能（页面目前为占位内容）

### 计划中（依据现有代码推断）

- 过期提醒（已引入 notification 插件）
- 数据格式版本迁移（`AppData.version` 字段已预留）

## 目录结构

```
expiry-tracker/
├── src/                        # 前端源码
│   ├── assets/                 # 静态资源
│   ├── components/             # 可复用 UI 组件（按子目录分组，如 Test/）
│   ├── constants/              # 固定常量（数据文件名、数据版本号）
│   ├── repositories/           # 数据访问与持久化（JSON 文件读写）
│   ├── router/                 # Vue Router 配置
│   ├── types/                  # 数据模型类型定义
│   ├── utils/                  # 通用工具（业务无关、可跨模块复用）
│   ├── validators/             # 数据格式与关联关系校验
│   ├── views/                  # 页面组件
│   ├── App.vue                 # 根组件（全局样式、安全区适配）
│   └── main.ts                 # 应用入口（注册 Pinia、Router、Vant 样式）
├── src-tauri/                  # Tauri / Rust 原生层
│   ├── capabilities/           # Tauri 权限配置（当前限定 Android）
│   ├── src/                    # Rust 源码（插件注册、Tauri 命令）
│   ├── tauri.conf.json         # Tauri 配置
│   └── gen/android/            # Tauri 生成的 Android 工程
└── vite.config.ts              # Vite 配置（@ 别名、Tauri 端口约定）
```

## 开发环境要求

- Node.js 与 pnpm
- Rust（通过 rustup 安装）
- Android 开发：Android Studio、SDK、NDK，并配置 `ANDROID_HOME`、`NDK_HOME` 等环境变量
- 环境搭建详见 [Tauri 官方文档](https://tauri.app/start/prerequisites/)

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm install` | 安装前端依赖 |
| `pnpm dev` | 启动 Vite 开发服务器（固定端口 1420） |
| `pnpm build` | 类型检查（`vue-tsc --noEmit`）+ 生产构建 |
| `pnpm preview` | 预览生产构建 |
| `pnpm exec vue-tsc --noEmit` | 仅执行 TypeScript 类型检查 |
| `pnpm tauri android dev` | Android 真机 / 模拟器开发运行 |
| `pnpm tauri android build` | 构建 Android APK / AAB |

> 注意：`pnpm tauri dev`（桌面端）当前缺少 fs 等插件权限——capability 文件有意限定 `platforms: ["android"]`（Android 优先策略），桌面端运行时涉及原生插件的功能将不可用。

## 推荐 IDE

- [VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 开发规范

面向 AI Agent 与开发者的架构约定、代码规范见 [AGENTS.md](./AGENTS.md)。
