#!/usr/bin/env npx ts-node
import * as fs from "fs"
import * as path from "path"

function findProjectRoot(): string {
  let dir = process.cwd()
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, ".git")) || fs.existsSync(path.join(dir, "package.json"))) {
      return dir
    }
    dir = path.dirname(dir)
  }
  return process.cwd()
}

const PROJECT_ROOT = findProjectRoot()
const TASKS_DIR = path.join(PROJECT_ROOT, ".tmp", "tasks")
const COMPLETED_DIR = path.join(TASKS_DIR, "completed")

interface Task {
  id: string
  name: string
  status: "active" | "completed" | "blocked" | "archived"
  objective: string
  context_files: string[]
  reference_files?: string[]
  exit_criteria: string[]
  subtask_count: number
  completed_count: number
  created_at: string
  completed_at: string | null
}

interface Subtask {
  id: string
  seq: string
  title: string
  status: "pending" | "in_progress" | "completed" | "blocked"
  depends_on: string[]
  parallel: boolean
  context_files: string[]
  reference_files?: string[]
  acceptance_criteria: string[]
  deliverables: string[]
  agent_id: string | null
  suggested_agent?: string
  started_at: string | null
  completed_at: string | null
  completion_summary: string | null
}

function getFeatureDirs(): string[] {
  if (!fs.existsSync(TASKS_DIR)) return []
  return fs.readdirSync(TASKS_DIR).filter((f) => {
    const fullPath = path.join(TASKS_DIR, f)
    return fs.statSync(fullPath).isDirectory() && f !== "completed"
  })
}

function loadTask(feature: string): Task | null {
  const taskPath = path.join(TASKS_DIR, feature, "task.json")
  if (!fs.existsSync(taskPath)) return null
  return JSON.parse(fs.readFileSync(taskPath, "utf-8"))
}

function loadSubtasks(feature: string): Subtask[] {
  const featureDir = path.join(TASKS_DIR, feature)
  if (!fs.existsSync(featureDir)) return []
  const files = fs.readdirSync(featureDir).filter((f) => /^subtask_\d{2}\.json$/.test(f)).sort()
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(featureDir, f), "utf-8")))
}

function saveSubtask(feature: string, subtask: Subtask): void {
  const subtaskPath = path.join(TASKS_DIR, feature, `subtask_${subtask.seq}.json`)
  fs.writeFileSync(subtaskPath, JSON.stringify(subtask, null, 2))
}

function saveTask(feature: string, task: Task): void {
  const taskPath = path.join(TASKS_DIR, feature, "task.json")
  fs.writeFileSync(taskPath, JSON.stringify(task, null, 2))
}

type SubtaskStatus = Subtask["status"]

function cmdStatus(feature?: string): void {
  const features = feature ? [feature] : getFeatureDirs()
  if (features.length === 0) {
    console.log("No active features found.")
    return
  }

  for (const f of features) {
    const task = loadTask(f)
    const subtasks = loadSubtasks(f)
    if (!task) {
      console.log(`\n[${f}] - No task.json found`)
      continue
    }

    const counts: Record<SubtaskStatus, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      blocked: 0,
    }
    for (const s of subtasks) counts[s.status]++

    const progress = subtasks.length > 0 ? Math.round((counts.completed / subtasks.length) * 100) : 0
    console.log(`\n[${f}] ${task.name}`)
    console.log(`  Status: ${task.status} | Progress: ${progress}% (${counts.completed}/${subtasks.length})`)
    console.log(`  Pending: ${counts.pending} | In Progress: ${counts.in_progress} | Completed: ${counts.completed} | Blocked: ${counts.blocked}`)
  }
}

function getCompletedSeqs(subtasks: Subtask[]): Set<string> {
  return new Set(subtasks.filter((s) => s.status === "completed").map((s) => s.seq))
}

function cmdNext(feature?: string): void {
  const features = feature ? [feature] : getFeatureDirs()
  console.log("\n=== Ready Tasks (deps satisfied) ===\n")

  for (const f of features) {
    const subtasks = loadSubtasks(f)
    const completedSeqs = getCompletedSeqs(subtasks)
    const ready = subtasks.filter((s) => s.status === "pending" && s.depends_on.every((dep) => completedSeqs.has(dep)))

    if (ready.length > 0) {
      console.log(`[${f}]`)
      for (const s of ready) console.log(`  ${s.seq} - ${s.title}  ${s.parallel ? "[parallel]" : "[sequential]"}`)
      console.log()
    }
  }
}

function cmdParallel(feature?: string): void {
  const features = feature ? [feature] : getFeatureDirs()
  console.log("\n=== Parallelizable Tasks Ready Now ===\n")

  for (const f of features) {
    const subtasks = loadSubtasks(f)
    const completedSeqs = getCompletedSeqs(subtasks)
    const parallel = subtasks.filter(
      (s) => s.status === "pending" && s.parallel && s.depends_on.every((dep) => completedSeqs.has(dep)),
    )

    if (parallel.length > 0) {
      console.log(`[${f}] - ${parallel.length} parallel tasks:`)
      for (const s of parallel) console.log(`  ${s.seq} - ${s.title}`)
      console.log()
    }
  }
}

function cmdDeps(feature: string, seq: string): void {
  const subtasks = loadSubtasks(feature)
  const target = subtasks.find((s) => s.seq === seq)
  if (!target) {
    console.log(`Task ${seq} not found in ${feature}`)
    return
  }

  console.log(`\n=== Dependency Tree: ${feature}/${seq} ===\n`)
  console.log(`${seq} - ${target.title} [${target.status}]`)
  if (target.depends_on.length === 0) {
    console.log("  └── (no dependencies)")
    return
  }

  const printDeps = (seqs: string[], indent = "  "): void => {
    for (let i = 0; i < seqs.length; i++) {
      const depSeq = seqs[i]
      const dep = subtasks.find((s) => s.seq === depSeq)
      const isLast = i === seqs.length - 1
      const branch = isLast ? "└──" : "├──"

      if (dep) {
        const icons: Record<SubtaskStatus, string> = { completed: "✓", in_progress: "~", pending: "○", blocked: "✗" }
        console.log(`${indent}${branch} ${icons[dep.status]} ${depSeq} - ${dep.title} [${dep.status}]`)
        if (dep.depends_on.length > 0) printDeps(dep.depends_on, indent + (isLast ? "    " : "│   "))
      } else {
        console.log(`${indent}${branch} ? ${depSeq} - NOT FOUND`)
      }
    }
  }

  printDeps(target.depends_on)
}

function cmdBlocked(feature?: string): void {
  const features = feature ? [feature] : getFeatureDirs()
  console.log("\n=== Blocked Tasks ===\n")

  for (const f of features) {
    const subtasks = loadSubtasks(f)
    const completedSeqs = getCompletedSeqs(subtasks)
    const blocked = subtasks.filter(
      (s) => s.status === "blocked" || (s.status === "pending" && !s.depends_on.every((dep) => completedSeqs.has(dep))),
    )

    if (blocked.length > 0) {
      console.log(`[${f}]`)
      for (const s of blocked) {
        const waitingFor = s.depends_on.filter((dep) => !completedSeqs.has(dep))
        const reason = s.status === "blocked" ? "explicitly blocked" : `waiting: ${waitingFor.join(", ")}`
        console.log(`  ${s.seq} - ${s.title} (${reason})`)
      }
      console.log()
    }
  }
}

function cmdComplete(feature: string, seq: string, summary: string): void {
  if (summary.length > 200) {
    console.log("Error: Summary must be max 200 characters")
    process.exit(1)
  }

  const subtasks = loadSubtasks(feature)
  const subtask = subtasks.find((s) => s.seq === seq)
  if (!subtask) {
    console.log(`Task ${seq} not found in ${feature}`)
    process.exit(1)
  }

  subtask.status = "completed"
  subtask.completed_at = new Date().toISOString()
  subtask.completion_summary = summary
  saveSubtask(feature, subtask)

  const task = loadTask(feature)
  if (task) {
    const updated = loadSubtasks(feature)
    task.completed_count = updated.filter((s) => s.status === "completed").length
    saveTask(feature, task)
  }

  console.log(`\n✓ Marked ${feature}/${seq} as completed`)
  console.log(`  Summary: ${summary}`)
  if (task) console.log(`  Progress: ${task.completed_count}/${task.subtask_count}`)
}

const REQUIRED_TASK_FIELDS = [
  "id", "name", "status", "objective", "context_files",
  "exit_criteria", "subtask_count", "completed_count", "created_at", "completed_at",
] as const

const REQUIRED_SUBTASK_FIELDS = [
  "id", "seq", "title", "status", "depends_on", "parallel", "context_files",
  "acceptance_criteria", "deliverables", "agent_id", "started_at", "completed_at", "completion_summary",
] as const

const VALID_TASK_STATUSES = new Set<Task["status"]>(["active", "completed", "blocked", "archived"])
const VALID_SUBTASK_STATUSES = new Set<Subtask["status"]>(["pending", "in_progress", "completed", "blocked"])

function hasField(obj: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, field)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string")
}

function cmdValidate(feature?: string): void {
  const features = feature ? [feature] : getFeatureDirs()
  let hasErrors = false

  console.log("\n=== Validation Results ===\n")

  for (const f of features) {
    const errors: string[] = []
    const task = loadTask(f)
    if (!task) errors.push("Missing task.json")

    const subtasks = loadSubtasks(f)
    const seqCounts = new Map<string, number>()
    for (const s of subtasks) {
      const seq = typeof s.seq === "string" ? s.seq : ""
      seqCounts.set(seq, (seqCounts.get(seq) || 0) + 1)
    }
    const seqs = new Set(subtasks.map((s) => s.seq))

    if (task) {
      for (const field of REQUIRED_TASK_FIELDS) {
        if (!hasField(task as unknown as Record<string, unknown>, field)) {
          errors.push(`task.json: missing required field '${field}'`)
        }
      }

      if (task.id !== f) errors.push(`task.json id ('${task.id}') should match feature slug ('${f}')`)
      if (!VALID_TASK_STATUSES.has(task.status)) errors.push(`task.json: invalid status '${task.status}'`)
      if (!isStringArray(task.context_files)) errors.push("task.json: context_files must be string[]")
      if (task.reference_files !== undefined && !isStringArray(task.reference_files)) {
        errors.push("task.json: reference_files must be string[] when present")
      }
      if (!isStringArray(task.exit_criteria)) errors.push("task.json: exit_criteria must be string[]")
      if (typeof task.subtask_count !== "number") errors.push("task.json: subtask_count must be number")
      if (typeof task.completed_count !== "number") errors.push("task.json: completed_count must be number")
    }

    for (const s of subtasks) {
      for (const field of REQUIRED_SUBTASK_FIELDS) {
        if (!hasField(s as unknown as Record<string, unknown>, field)) {
          errors.push(`${s.seq || "??"}: missing required field '${field}'`)
        }
      }

      if (!/^\d{2}$/.test(s.seq)) errors.push(`${s.seq}: sequence must be 2 digits (e.g., 01, 02)`)
      if ((seqCounts.get(s.seq) || 0) > 1) errors.push(`${s.seq}: duplicate sequence number`)
      if (!s.id.startsWith(f)) errors.push(`${s.seq}: ID should start with feature name`)
      if (!VALID_SUBTASK_STATUSES.has(s.status)) errors.push(`${s.seq}: invalid status '${s.status}'`)

      if (!isStringArray(s.depends_on)) errors.push(`${s.seq}: depends_on must be string[]`)
      if (typeof s.parallel !== "boolean") errors.push(`${s.seq}: parallel must be boolean`)
      if (!isStringArray(s.context_files)) errors.push(`${s.seq}: context_files must be string[]`)
      if (s.reference_files !== undefined && !isStringArray(s.reference_files)) {
        errors.push(`${s.seq}: reference_files must be string[] when present`)
      }

      if (!isStringArray(s.acceptance_criteria)) {
        errors.push(`${s.seq}: acceptance_criteria must be string[]`)
      } else if (s.acceptance_criteria.length === 0) {
        errors.push(`${s.seq}: No acceptance criteria defined`)
      }

      if (!isStringArray(s.deliverables)) {
        errors.push(`${s.seq}: deliverables must be string[]`)
      } else if (s.deliverables.length === 0) {
        errors.push(`${s.seq}: No deliverables defined`)
      }

      if (Array.isArray(s.depends_on)) {
        if (s.depends_on.includes(s.seq)) errors.push(`${s.seq}: task cannot depend on itself`)
        for (const dep of s.depends_on) {
          if (!seqs.has(dep)) errors.push(`${s.seq}: depends on non-existent task ${dep}`)
        }
      }

      // Circular dependency check
      const findCircular = (current: string, path: string[], visited: Set<string>): boolean => {
        if (path.includes(current)) {
          errors.push(`${s.seq}: circular dependency detected: ${[...path, current].join(" -> ")}`)
          return true
        }
        if (visited.has(current)) return false
        visited.add(current)

        const depTask = subtasks.find((t) => t.seq === current)
        if (!depTask) return false

        for (const dep of depTask.depends_on) {
          if (findCircular(dep, [...path, current], visited)) return true
        }
        return false
      }
      findCircular(s.seq, [], new Set())
    }

    if (task && task.subtask_count !== subtasks.length) {
      errors.push(`task.json subtask_count (${task.subtask_count}) doesn't match actual count (${subtasks.length})`)
    }

    console.log(`[${f}]`)
    if (errors.length === 0) {
      console.log("  ✓ All checks passed")
    } else {
      for (const e of errors) {
        console.log(`  ✗ ERROR: ${e}`)
        hasErrors = true
      }
    }
    console.log()
  }

  process.exit(hasErrors ? 1 : 0)
}

const COMMANDS: Record<string, () => void> = {
  status: () => cmdStatus(args[0]),
  next: () => cmdNext(args[0]),
  parallel: () => cmdParallel(args[0]),
  deps: () => {
    if (args.length < 2) {
      console.log("Usage: deps <feature> <seq>")
      process.exit(1)
    }
    cmdDeps(args[0], args[1])
  },
  blocked: () => cmdBlocked(args[0]),
  complete: () => {
    if (args.length < 3) {
      console.log('Usage: complete <feature> <seq> "summary"')
      process.exit(1)
    }
    cmdComplete(args[0], args[1], args.slice(2).join(" "))
  },
  validate: () => cmdValidate(args[0]),
}

function printUsage(): void {
  console.log(`Task Management CLI

Usage: npx ts-node task-cli.ts <command> [feature] [args...]

Task files are stored in: .tmp/tasks/{feature-slug}/

Commands:
  status [feature]                  Show task status summary
  next [feature]                    Show next eligible tasks (deps satisfied)
  parallel [feature]                Show parallelizable tasks ready to run
  deps <feature> <seq>              Show dependency tree for a task
  blocked [feature]                 Show blocked tasks and why
  complete <feature> <seq> "summary" Mark task completed with summary
  validate [feature]                Validate JSON files and dependencies

Examples:
  npx ts-node task-cli.ts status
  npx ts-node task-cli.ts next my-feature
  npx ts-node task-cli.ts complete my-feature 02 "Implemented auth module"
`)
}

const [, , command, ...args] = process.argv
const handler = COMMANDS[command]
if (handler) handler() else printUsage()
