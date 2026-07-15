# Repository Guidelines

## Project Overview

**ework-log** — 自动生成月度工作日志的工具。通过解析考勤 Excel（`work.xlsx`）和 Git 提交记录，合并生成每日工作内容报告。

**作者**: 姚瑞东 (yaoruidong@meix.com)

---

## Architecture & Data Flow

```
work.xlsx            Git repos (27 projects under ~/meix/)
    │                       │
    ▼                       ▼
work_time_collect.js   git_info_collect.js
    │                       │
    ▼                       ▼
  time.md                git.md
    │                       │
    └─────────┬─────────────┘
              ▼
    generate_work_info.js
              │
              ▼
      merged_git_work.md
```

**数据流向**:

1. **`git_info_collect.js`** → 调用 `getDateRangeFromExcel()` 从 `work.xlsx` 动态解析首尾日期作为时间区间，扫描 `~/meix/` 下所有 Git 仓库，获取该范围内的提交记录 → 输出 `git.md`（日期 | 项目 | 提交内容 | Hash）
2. **`work_time_collect.js`** → 读取 `work.xlsx`（考勤导出），解析日期、班次、实际工作时长，通过 Timor API 过滤节假日/周末 → 输出 `time.md`（日期 | 班次 | 实际工作时长）
3. **`generate_work_info.js`** → 按日期合并 `time.md` 和 `git.md` → 输出 `merged_git_work.md`

**流水线**: 执行 `run.sh` 即可依次运行以上三步。

---

## Key Directories

| 路径 | 用途 |
|------|------|
| `/` | 核心 JS 脚本、Shell 流水线、输出 MD 文件 |
| `logs/` | Git 日志临时文件（每个仓库一个 `.log`） |
| `.history/` | 历史输出存档（Git 忽略） |

---
## Development Commands

```bash
# 运行完整流水线（清空旧输出 → 采集 Git → 解析考勤 → 合并报告）
bash run.sh

# 分步执行（调试用）
node git_info_collect.js    # 仅采集 Git 提交 → git.md
node work_time_collect.js   # 仅解析考勤 → time.md
node generate_work_info.js  # 仅合并报告（需要 git.md + time.md 已存在）
```

**日期范围自动获取**：`git_info_collect.js` 中的 `getDateRangeFromExcel()` 函数从 `work.xlsx` 的首尾数据行动态读取时间区间，无需手动编辑。

**无构建步骤** — 纯 Node.js 脚本，直接运行。无 TypeScript/ESLint/Prettier/EditorConfig 等工具链。


## Code Conventions & Common Patterns

### Naming

- 文件：`snake_case.js`（小写+下划线）
- 变量/函数：`camelCase`
- 常量：`UPPER_SNAKE_CASE`
- 日期格式：`YYYY-MM-DD`

### Error Handling

```javascript
// try-catch 包裹所有顶层操作
try {
  // 文件读写、外部 API 调用
} catch (err) {
  console.error("操作失败:", err.message);
}

// 可选链调用（?.）和空值合并（??）用于安全访问嵌套属性
row[6] != null ? String(row[6]).trim() : ''
```

### Async Pattern

- 使用 **顶层 IIFE async**（非 `async function main()` + 调用）：

```javascript
(async () => {
  const results = await Promise.all(promises);
  // 处理结果
})();
```

- 使用 `Promise.all` 并发获取节假日 API 数据
- `fetchHolidayYear()` 返回 `Promise`，通过 `https.get` 手动封装

### Date Handling

- Excel 序列号日期 → `excelDateToJSDate(serial)`（基于 1899-12-30 + 天数偏移）
- 中文日期格式 `"2026/06/01 星期一"` → 正则提取 `YYYY-MM-DD`
- 时区假设：UTC+8（北京时间）

### Data Parsing

- `xlsx` 库读取 Excel（`header: 1` 模式解析行数组）
- Git 日志通过 `execSync` 执行 `git log` 命令
- Markdown 表格解析使用简单的字符串分割（`split('|')`），非第三方库

### Holiday API

- 使用 [Timor API](https://timor.tech/api/holiday/year/{year}) 获取中国法定节假日数据
- 状态码：`0=工作日`, `1=周末`, `2=法定节假日`, `3=调休补班`
- 按状态自动过滤非工作日

### Git Commit Convention

- 统一使用 [gitmoji](https://gitmoji.dev) 前缀：`✨ feat`, `🐛 fix`, `♻️ refactor`, `🎨 style`, `📝 docs`, `🔧 chore`, `🔥 chore`, `💚 ci`
- 提交信息包含 scope（如 `feat(board)`、`fix(auth)`）

---

## Important Files

| 文件 | 作用 |
|------|------|
| `work.xlsx` | **必选输入** — 考勤系统导出的 Excel 月报 |
| `work_time_collect.js` | 解析考勤 Excel，过滤周末/节假日，输出 `time.md` |
| `git_info_collect.js` | 扫描 Git 仓库，收集提交记录，输出 `git.md` |
| `generate_work_info.js` | 合并 `time.md` + `git.md` → `merged_git_work.md` |
| `run.sh` | 流水线调度脚本 |
| `package.json` | 项目元数据，唯一依赖：`xlsx` |
| `.gitignore` | 忽略 `.DS_Store`, `.env`, `.history/`, `node_modules/` |

### 生成文件（Git 忽略可删）

| 文件 | 来源 |
|------|------|
| `time.md` | `work_time_collect.js` 输出 |
| `git.md` | `git_info_collect.js` 输出 |
| `merged_git_work.md` | 最终合并报告 |
| `logs/*.log` | Git 提交临时日志 |

---

## License

- **实际**: **GNU General Public License v3.0**（`LICENSE` 文件为 GPL-3.0 全文）
- **package.json 声明**: `ISC`（与实际文件不一致，注意）

---

## Runtime/Tooling Preferences
| **Runtime** | **Node.js** (≥ 18.x) — CommonJS (`require`), 无 ESM |
| **Package Manager** | npm（`package-lock.json` 被 gitignore，每次 `npm install` 可能产生不同解析）|
| **唯一依赖** | `xlsx` (`^0.18.5`) — Excel 文件解析，间接依赖 8 个包 |
| **工具链** | ❌ 无 TypeScript · 无 ESLint · 无 Prettier · 无 EditorConfig · 无 Bundler |
| **入口** | 流水线：`bash run.sh`；直接运行：`node <script>.js` |
| **作业系统** | macOS (Darwin arm64) |

## Testing & QA

### 当前状态
| 项目 | 状态 |
|------|------|
| 测试框架 | ❌ 无 |
| 测试文件 | ❌ 零（无 `*.test.*`、`__tests__/`、`test/`） |
| CI/CD | ❌ 无 |
| 覆盖率 | ❌ 0% |
| package.json test 脚本 | 占位符 (`echo \"Error: no test specified\" && exit 1`) |
| devDependencies | 空对象 `{}` |

### 推荐测试方案

使用 **Node.js 内置 `node:test` + `node:assert/strict`**（Node ≥ 18）——零额外依赖，与项目极简理念一致。

### 优先级测试目标（纯函数）

| # | 函数 | 文件 | 测试重点 |
|---|------|------|---------|
| 1 | `parseDurationToHours(val)` | `work_time_collect.js` | `8.0`, `8:00`, `8小时`, `--`, `null`, `undefined` |
| 2 | 日期正则提取 | `work_time_collect.js` | `"2026/06/01 星期一"` → `"2026-06-01"` |
| 3 | `excelDateToJSDate(serial)` | `work_time_collect.js` | Excel 序列号 → JS Date 转换 |
| 4 | 节假日状态过滤 | `work_time_collect.js` | status `0/1/2/3` 的跳过/保留逻辑 |
| 5 | `parseMDTable(filePath)` | `generate_work_info.js` | Markdown 表格 split/filter/map 管道 |
| 6 | Git log 正则解析 | `git_info_collect.js` | commit 信息解析 |
| 7 | 日期范围边界 | `git_info_collect.js` | 首尾日期、空数据 |

### 建议测试文件结构

```
test/
  parseDurationToHours.test.js
  dateParsing.test.js
  excelDateConversion.test.js
  markdownTable.test.js
  gitLogParsing.test.js
  fixtures/
    sample_git_log.txt
    sample_markdown_table.md
```

### 约束说明

- 所有 JS 文件使用 `require()`（CommonJS）—— `node:test` 支持 CommonJS：`const { describe, it } = require('node:test')`
- 函数目前为内联（未导出）—— 需重构为 `module.exports` 才能单元测试
- `execSync` 调用需要 mock 才能隔离测试
- Timor API 调用需要 mock 或 fixture 数据
---

## 项目演进历史 (from `.history/`)

`.history/` 目录记录了脚本的迭代过程（Git 忽略）：

| 阶段 | 时间 | 变化 |
|------|------|------|
| **v1** | 2025-01 | 硬编码列名，简单字符串解析，无节假日 API |
| **v2** | 2025-12 → 2026-07 | `git_info_collect` 加入进度跟踪、空日志清理、仓库有效性检查 |
| **v3** | 2026-06 | `work_time_collect` 加入 Timor 节假日 API、增强时间解析（`hh:mm`、`X小时`、`h`）、完善周末/节假日过滤 |
| **当前** | 2026-07 | 适配新考勤 Excel 格式（`header: 1` 列索引解析），日期范围同步更新 |

**已被移除**: `work_weekly_report_v3` 和 `work_summary_report_v3` 周报/汇总生成器（2026-06 的历史中存在，但代码库中已删除）

## 文档缺口

- 无 README.md、CHANGELOG.md 或 CLAUDE.md
- 无 JSDoc 或内联 API 文档
- 代码注释稀疏且多为中文

---

## 工作流提示 (for AI agents)

- AGENTS.md 被 Git 忽略（即使添加了 `.history/` 匹配规则）— 如需持久化请显式 git add
- `work.xlsx` 是考勤系统月报导出，需每月手动替换
- `git_info_collect.js` 中的 `START_DATE`/`END_DATE` 需跟随目标月份调整
- 所有输出文件在 `run.sh` 执行时自动清除重建
- 员工信息：姚瑞东，09:00-18:00 班次
- 扫描路径 `~/meix/` 下有 27 个 Git 仓库（6 个在 6月有活跃提交）
- Timor 节假日 API 在无网络时自动降级为自然周末过滤
