# AGENTS.md

本文件面向 AI Coding Agent 与开发者，描述本项目的架构约定与开发规范。项目基本信息、技术栈版本与运行命令见 [README.md](./README.md)。

规范分两类：

- **现行约定**：从现有代码中归纳，修改代码时必须遵循。
- **建议**：现有代码尚未覆盖的部分，新增同类代码时采用。

---

## 1. 项目技术约束（硬性）

- Tauri **2.x**，禁止使用 Tauri 1.x 的 API 与配置格式。
- 前端：Vue 3 Composition API + TypeScript strict 模式。
- 优先面向 **Android** 平台开发；不要直接照搬 Tauri 桌面端的实现方式。
- 平台能力优先使用 Tauri 2.x 官方插件；确有必要才引入 Rust 或 Android Kotlin 原生实现。
- **禁止编造 API、插件和配置字段**。不确定时先查 Tauri 官方文档或项目内已有用法，再动手。
- UI 组件使用 Vant 4；不引入其他 UI 库。

## 2. 目录组织与职责

以下为 `src/` 下**实际存在**的目录及其职责：

| 目录            | 职责                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `views/`        | 页面组件，文件名 `XxxView.vue`，由 router 懒加载                                                                                                                                         |
| `components/`   | 可复用 UI 组件，按子目录分组（如 `Test/` 为开发测试组件）                                                                                                                                |
| `composables/`  | 依赖 Vue 响应式上下文的可复用业务逻辑，文件名 `useXxx.ts`（如 `useAppDataMutations.ts`）                                                                                                 |
| `stores/`       | Pinia store：状态管理与初始化。文件名 kebab-case、以 `-store.ts` 结尾（`app-data-store.ts`），导出函数 `useXxxStore`；数量按状态职责与数据一致性需求合理确定，避免重复存储同一份业务状态 |
| `router/`       | 路由配置；hash 历史、命名路由、懒加载                                                                                                                                                    |
| `constants/`    | 固定常量（数据文件名、数据格式版本号等）                                                                                                                                                 |
| `types/`        | 业务数据模型类型定义，一个领域一个文件                                                                                                                                                   |
| `utils/`        | 通用工具函数：与具体业务领域无关、适合跨模块复用；原则上不依赖 Vue 响应式上下文与 Tauri 原生能力（`import.meta.env` 等构建环境能力除外）                                                 |
| `validators/`   | 数据格式与关联关系校验，只判断不修改                                                                                                                                                     |
| `services/`     | 依赖业务模型、但不依赖 Vue 的可复用业务规则（如 `category-service.ts` 的分类名称解析与复用）                                                                                             |
| `repositories/` | 数据访问与持久化，唯一允许执行文件 IO 的位置                                                                                                                                             |
| `assets/`       | 静态资源；`styles/tokens.css` 存放全局设计令牌（CSS 自定义属性）                                                                                                                         |

`src-tauri/` 为 Tauri / Rust / 原生层：

- `src/lib.rs`：插件注册与 Tauri 命令；`tauri.conf.json`：应用配置。
- `capabilities/default.json`：权限配置，**当前限定 `platforms: ["android"]`**。
- `gen/android/`：Tauri 生成的 Android 工程；Gradle 配置与 Manifest 可修改，但需了解 Tauri 对部分文件有生成逻辑。

### 分层协作

- 依赖方向：`views / components` →（`stores`、`composables`）→ `services` / `repositories` → `validators` / `constants` / `types`；`utils` 被所有层复用，但不反向依赖业务层。
- **文件 IO 只发生在 `repositories/`**，页面与 store 不得直接调用 `@tauri-apps/plugin-fs`（`components/Test/` 下的开发测试组件除外）。
- 数据写盘前必须经过 `validators/` 校验；校验函数不得修改传入数据。

## 3. Vue 代码规范

**现行约定**（来自现有组件）：

- 一律使用 `<script setup lang="ts">`，SFC 块顺序：`script` → `template` → `style scoped`。
- 只用 Composition API；路由使用 `useRouter()`，命名路由跳转。
- 忽略 Promise 返回值时使用 `void` 前缀显式标记（如 `void router.push(...)`）。
- Vant 组件从 `'vant'` 命名导入（如 `import { Button, NavBar } from 'vant'`）；样式在 `main.ts` 全量引入 `vant/lib/index.css`。**不使用**自动按需导入插件。
- 异步原生调用的错误处理模式：`try/catch` + `error instanceof Error ? error.message : String(error)`（参考 `NativePlugin.vue` 的 `errorMessage()`）。
- 页面样式用 `<style scoped>`。全局样式分两类：设计令牌（CSS 自定义属性）统一放在 `src/assets/styles/tokens.css`，由 `main.ts` 在 Vant 样式之后引入；其余全局样式（重置、`body`、安全区等）只放 `App.vue`。令牌统一使用 `--et-` 前缀，底层优先引用 Vant 变量。

**建议**（现有代码尚无用例，新增时采用）：

- Props / Emits 使用类型声明形式：`defineProps<{...}>()`、`defineEmits<{...}>()`。
- 组件内事件监听、定时器等资源在 `onUnmounted` 中清理。
- 可复用的响应式逻辑提取到 `composables/`，不在多个组件间复制粘贴。

## 4. TypeScript 规范

**现行约定**：

- 代码风格已全库统一：单引号、无分号、2 空格缩进，由 Prettier 维护（配置见 `.prettierrc.json`，行宽 80、尾随逗号 all）。提交代码前执行 `pnpm format`（或确保 `pnpm format:check` 通过）；`tsconfig*.json` 等 JSON 配置文件保留双引号由 Prettier 自动处理，无需手工调整。
- `tsconfig.json` 已开启 `strict`、`noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch`，不得关闭。
- 业务数据模型使用 `interface`，定义在 `src/types/`（如 `Category`、`Item`、`AppData`）；仅在单个组件内使用的局部类型就近定义。
- 纯类型导入使用 `import type`。
- 处理外部输入（`JSON.parse` 结果、插件返回值等）时入参声明为 `unknown`，通过类型守卫收窄：`value is X`；断言函数使用 `asserts value is X`（参考 `app-data-validator.ts`）。
- 工具集合使用 `const` 对象命名空间导出（`StringUtils`、`ArrayUtils`、`ObjectUtils`）；简单工具也可用具名函数（`isDev()`）。
- 避免使用 `any`（`vite-env.d.ts` 中 `*.vue` shim 除外，该文件为既有兼容声明）。

**建议**：

- 数据结构演进时优先保持向后兼容；破坏性变更依赖 `AppData.version` 识别旧数据（版本号在 `src/constants/app-data.ts`）。
- 新文件命名：类型与工具文件 kebab-case（`item-group.ts`），Vue 组件文件 PascalCase（`NativePlugin.vue`）。

## 5. 模块导入规范

**现行约定**：

- `@` 别名已同时配置于 `vite.config.ts`（`resolve.alias`）与 `tsconfig.json`（`paths`），指向 `src/`。**`src` 内跨模块引用一律使用 `@/`**（已全库统一；`.vue` 组件导入需保留 `.vue` 扩展名，其余模块不写扩展名）。
- 第三方依赖使用包名导入：`vue` / `vue-router` / `pinia` / `vant`；Tauri 插件为 `@tauri-apps/plugin-*`。
- 类型导入单独成行：`import type { AppData } from '@/types/app-data'`。

## 6. 通用逻辑复用

- 与业务领域无关的通用函数放 `utils/`（原则上不依赖 Vue 响应式上下文与 Tauri 原生能力，`import.meta.env` 等构建环境能力除外）；依赖 Vue 响应式/生命周期的放 `composables/`；数据持久化放 `repositories/`；数据合法性判断放 `validators/`。
- 同一逻辑禁止在页面组件中重复实现；实现前先检查 `utils/`、`repositories/` 是否已有对应能力。
- **不要为了封装而封装**：单处使用的逻辑不必提前抽象；`utils/` 中保持“业务无关”这条底线，业务专用判断不进入 `utils/`。

## 7. 数据层约定

数据层（types / constants / validators / repositories）为已确定的架构，修改需谨慎：

- `AppData` 由 `version`（**数据格式版本号，非 App 版本号**）、`groups`、`items`、`categories` 组成，持久化为应用数据目录根下的 `app-data.json`（`BaseDirectory.AppData`）。
- `validateAppData()` 是唯一的校验入口，覆盖：结构、字段类型、全量 ID 唯一性、跨实体引用有效性（item→group、group→category）、分类名归一化去重。
- **Validator 只判断不修改**：允许临时计算标准化值用于比较（如分类名经 `trim()` + `toLowerCase()` 后判断重复性，与现有实现一致），但标准化计算不得改动传入的数据对象；去空格、补默认值、修正数据等行为由业务层负责，也不得为了让非法数据通过校验而偷偷修改原始数据。
- Repository 行为约定：
  - `load()`：文件不存在时创建初始空数据；文件损坏或校验失败时**抛错，绝不覆盖原文件**。
  - `save()`：入队前先校验并序列化，避免保存内容与调用时不一致。
  - 所有文件操作经内部 Promise 队列**串行执行**，防止读写交叉。该队列的能力边界：仅保证**当前 JavaScript 运行实例内**、经同一队列提交的操作串行；不提供跨进程 / 跨运行实例的文件锁；**不等同于**原子写入或数据损坏保护。对「读取 → 修改 → 写回」类操作，应保证完整流程的一致性，避免并发更新丢失；写入中断、应用异常终止等情况需要额外的数据保护与恢复设计（**尚未实现**，当前写入为直接覆盖）。
- 扩展数据结构的步骤：先改 `types/` → 视兼容性更新 `constants/` 中版本号 → 同步修改 validator → 不兼容变更需设计迁移逻辑（迁移机制尚未实现，仅预留 `version`）。

## 8. Tauri 与 Android 规范

- 新增 Tauri 插件必须**双侧同步**：Rust 侧 `Cargo.toml` 依赖 + `lib.rs` 中 `.plugin(...::init())`；前端侧 `package.json` 依赖；并在 `capabilities/default.json` 中声明所需 permission。缺任一侧会导致运行时失败。
- 权限管理集中在 `src-tauri/capabilities/default.json`。当前限定 `platforms: ["android"]` 是**有意采用的 Android 优先策略**，目前不需要为桌面调试放开；未来如需桌面端原生插件调试，再评估新增独立桌面 Capability 或扩展平台配置，不擅自修改 Capability 文件。
- 不同插件 API 的返回类型不同，**不能统一假定都返回 Promise**。例如 `@tauri-apps/plugin-notification` 中 `isPermissionGranted()` 返回 `Promise<boolean>`，而 `sendNotification()` 返回 `void`；使用前先确认实际函数签名。
- 返回 Promise 的操作使用 `await` 配合 `try/catch`（或显式处理 rejection），错误按 `unknown` 类型安全处理（参考 `errorMessage()` 模式）。
- 原生 API 调用成功不一定代表 Android 系统层面的操作最终成功（如通知是否实际送达），需结合具体功能在真机或模拟器上验证。
- 本地文件访问约定：统一使用 `BaseDirectory.AppData` + `src/constants/` 中的文件名常量，不在组件内硬编码路径。
- Android 注意事项：
  - `applicationId` / namespace 为 `com.home.expirytracker`，与 `tauri.conf.json` 的 `identifier` 保持一致。
  - 界面需适配安全区（`App.vue` 已通过 `env(safe-area-inset-*)` 处理）。
  - 通知等功能涉及运行时权限，参考 `NativePlugin.vue` 中「先查询、再请求」的模式。
- Rust 侧修改后用 `cargo check`（在 `src-tauri/` 下执行）验证编译。

## 9. 代码修改原则

- **修改前先阅读**相关现有代码，理解已有约定后再动手。
- 优先复用已有类型、工具函数和模块；不引入重复实现。
- 遵循现有目录结构与命名风格；新文件放对应职责目录。
- 不随意添加新依赖；确需添加时说明理由。
- 不做与当前任务无关的大规模重构（包括批量改引号风格、批量替换旧导入路径）。
- 新代码保持职责单一、类型安全；不使用 `any` 逃避类型问题。
- 涉及跨平台/原生能力的修改，明确验证 Android 真机或模拟器上的表现。
- 修改后执行与变更范围匹配的检查：
  - 前端：`pnpm exec vue-tsc --noEmit`（或 `pnpm build`）。
  - Rust：`cargo check`。
- 修改核心数据模型、持久化语义、校验策略（第 7 节）等关键架构前，应说明修改原因、兼容性影响及潜在数据安全风险；未经用户确认，不得擅自进行破坏性架构调整。
- 在保持现有架构约定与对外行为的前提下，可正常进行功能扩展及必要的内部实现优化；不得以「最佳实践」为由擅自替换已确定的技术方案。

### 任务完成后的汇报

完成开发任务后，向用户简要汇报：

1. **修改内容**：新增、修改或删除了哪些关键文件及其职责。
2. **实现说明**：主要实现方案与关键设计原因。
3. **验证结果**：实际执行过哪些检查及结果；未执行的检查不得声称通过。
4. **注意事项**：已知限制、潜在风险与未完成事项。
5. **Git Commit 建议**：给出符合 Conventional Commits 的提交信息；未经用户明确要求，不主动提交。

反馈应简洁、重点突出：简单修改不需要冗长说明；复杂架构修改应适当解释实现机制与技术取舍。

## 10. Git Commit 规范

采用 Conventional Commits（与现有提交历史一致）：

```
type(scope): description
```

- `type`：`feat` / `fix` / `refactor` / `chore` / `docs` / `test`。
- `scope`：对应明确模块，如 `data`、`utils`、`types`、`config`、`tauri`；无明确归属时可省略。
- 描述语言：英文（现有历史均为英文）。
- 提倡小步提交：每次提交只包含一个逻辑完整的修改；必要时在正文补充说明动机与细节。

## 11. 代码风格工具

- 项目已引入 **Prettier** 作为前端代码与文档的统一格式化工具：配置 `.prettierrc.json`，忽略规则 `.prettierignore`，脚本 `pnpm format` / `pnpm format:check`。
- Prettier 覆盖 Vue / TS / JS / CSS / JSON / Markdown 等文件；**不负责 Rust**，Rust 代码继续使用 `rustfmt`。
- 格式化范围由 `.prettierignore` 控制，排除 `node_modules`、`dist`、`src-tauri/target`、`src-tauri/gen`、锁文件等。
- 批量格式化应作为独立任务执行，不与业务功能开发混合。
- 后续规划：引入 ESLint 检查代码质量（本次未引入）。
