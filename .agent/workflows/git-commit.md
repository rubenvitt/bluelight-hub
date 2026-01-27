---
description: Commit the changes based on project rules
---

# /git-commit Command

When this command is used, execute the following workflow:

<!-- BlueLight Hub Git Commit Workflow -->

# git-commit

ACTIVATION-NOTICE: This file contains the complete git commit workflow. Execute immediately upon invocation.

CRITICAL: Read and execute the workflow defined in the YAML block below:

## COMPLETE WORKFLOW DEFINITION - NO INTERACTION REQUIRED

```yaml
activation-instructions:
  - STEP 1: Execute this workflow immediately without user interaction
  - STEP 2: Create a professional git commit following project standards
  - STEP 3: Complete the commit and report results
  - NO USER INTERACTION: Execute all steps automatically

workflow:
  name: Git Commit
  id: git-commit
  title: Professional Git Commit Creator
  icon: 📝
  purpose: Create perfect git commits with semantic versioning emojis

execution_steps:
  1_analyze:
    parallel_commands:
      - git status
      - git diff --staged
      - git diff
      - git log --oneline -5
    purpose: Gather all information about changes

  2_process:
    actions:
      - Analyze all staged and unstaged changes
      - Identify change type (feature/fix/refactor/etc)
      - Check for sensitive information
      - Determine appropriate emoji and context

  3_prepare:
    actions:
      - Stage relevant untracked files with git add
      - Generate commit message following format

  4_commit:
    format: |
      git commit -m "$(cat <<'EOF'
      <emoji>(<context>): <title>

      <optional description if complex changes>
      EOF
      )"

  5_verify:
    actions:
      - Run git status to confirm success
      - If pre-commit hooks modify files, amend commit
      - Report completion status

commit_rules:
  format: "<emoji>(<context>): <title>"
  language: English
  mood: Imperative ("Add" not "Added")
  title_length: 50-72 characters

emoji_reference:
  breaking: "💥 - Breaking Changes (Major)"
  feature: "✨ - New Features (Minor)"
  fix: "🐛 - Bug Fixes (Patch)"
  hotfix: "🚑 - Critical Hotfixes"
  security: "🔒 - Security Fixes"
  refactor: "♻️ - Code Refactoring"
  config: "🔧 - Configuration"
  docs: "📝 - Documentation"
  test: "✅ - Tests"
  style: "🎨 - UI/Style Updates"
  perf: "⚡ - Performance"
  ci: "👷 - CI/CD Changes"
  chore: "🔨 - Build/Dev Tools"
  wip: "🚧 - Work in Progress"
  revert: "⏪ - Revert Changes"

context_mapping:
  frontend: React/Vite UI components
  backend: NestJS API services
  shared: Shared utilities/types
  db: Database/Prisma changes
  auth: Authentication system
  api: API client/generation
  config: Configuration files
  docs: Documentation
  tests: Test files
  ci: CI/CD pipeline

critical_rules:
  - NEVER use --no-verify flag
  - NEVER use HUSKY=0
  - NEVER create empty commits
  - NEVER commit secrets or API keys
  - If tests fail on simple fixes → fix directly
  - If tests fail on complex issues → abort and report

completion:
  success: "✅ Commit created successfully"
  failure: "❌ Commit failed - check errors above"

examples:
  - "✨(frontend): Add user dashboard with activity feed"
  - "🐛(backend): Fix JWT token expiration handling"
  - "♻️(shared): Refactor date utilities for better performance"
  - "💥(api): Change response format to nested structure"
  - "🔒(auth): Fix SQL injection vulnerability in login"
  - "⚡(frontend): Optimize bundle size with lazy loading"
```
