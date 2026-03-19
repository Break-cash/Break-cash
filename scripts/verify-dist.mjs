import { access } from 'node:fs/promises'
import path from 'node:path'

const requiredFiles = [
  'dist/index.html',
  'dist/assets',
]

async function main() {
  for (const relativePath of requiredFiles) {
    const absolutePath = path.resolve(process.cwd(), relativePath)
    await access(absolutePath)
  }

  console.log('Prebuilt production bundle detected in dist/. Skipping source rebuild.')
}

main().catch((error) => {
  console.error('Build verification failed:', error.message)
  process.exit(1)
})
