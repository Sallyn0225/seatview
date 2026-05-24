<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->

## 项目级上下文（与 `.trellis/` 平级，跨任务通用）

项目根有两份全局上下文文件，**任何 sub-agent 在面向用户的设计或实现工作开始前必读**：

- **`PRODUCT.md`** —— 产品定位：双类用户、双语等价、Brand Personality、Anti-references、6 条 Design Principles、WCAG 2.1 AA 基线。
- **`DESIGN.md`** —— 视觉设计语言（当前 seed 阶段）：创意北极星「The Quiet Folio · 静纸」、Restrained 色彩策略、Noto 同源双语字体方向、Flat Folio 无阴影规则、Named Rules、Do's and Don'ts。

由 `/impeccable` skill（位于 `.claude/skills/impeccable/`）维护，与 Trellis 的 spec / task 上下文不互相替代。
