#!/usr/bin/env node
import('../dist/index.js').catch(() => {
  import('tsx').then(() => import('../src/index.ts'))
})
