import { query } from '@anthropic-ai/claude-agent-sdk'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const task = process.env.TASK

if (!task) {
  console.error('❌ לא נמצאה משימה (TASK env var)')
  process.exit(1)
}

console.log('🤖 מבצע משימה:', task)

for await (const message of query({
  prompt: task,
  options: {
    cwd: repoRoot,
    allowedTools: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
  },
})) {
  if ('result' in message && message.result) {
    console.log('✅ הושלם:', message.result)
  }
}
