import https from 'node:https'
import { WebmOpusDemuxer } from './src/player/webm-demuxer.js'
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const OpusScript = require('opusscript') as typeof import('opusscript')

// Test 1: Download the same YouTube URL that Sonata uses and decode it
const uri = process.argv[2]
if (!uri) {
  console.error('Usage: node test-audio.js <youtube-audio-url>')
  process.exit(1)
}

console.log('Testing audio pipeline...')
console.log(`URL: ${uri.substring(0, 80)}...`)

// Decoder
const decoder = new OpusScript(48000, 2, OpusScript.Application.AUDIO)

// Demuxer
const demuxer = new WebmOpusDemuxer()
let frameCount = 0
let pcmTotal = 0
const allPcm: Buffer[] = []

demuxer.on('data', (opusPacket: Buffer) => {
  try {
    const pcm = decoder.decode(opusPacket)
    allPcm.push(Buffer.from(pcm))
    frameCount++
    pcmTotal += pcm.length
    if (frameCount % 100 === 0) {
      console.log(`Decoded ${frameCount} frames, ${(pcmTotal / 48000 / 4).toFixed(1)}s of audio`)
    }
  } catch (e) {
    console.error(`Decode error at frame ${frameCount}:`, e)
  }
})

demuxer.on('end', () => {
  console.log(`\n=== Pipeline Test Complete ===`)
  console.log(`Total frames: ${frameCount}`)
  console.log(`Total PCM: ${pcmTotal} bytes (${(pcmTotal / 48000 / 4).toFixed(1)}s at 48kHz stereo 16-bit)`)

  if (allPcm.length > 0) {
    // Write first 10 seconds as raw PCM to verify
    const sampleRate = 48000
    const channels = 2
    const tenSecs = sampleRate * channels * 2 * 10 // 10 seconds of 16-bit stereo
    let written = 0
    const outChunks: Buffer[] = []
    for (const buf of allPcm) {
      if (written >= tenSecs) break
      const needed = Math.min(buf.length, tenSecs - written)
      outChunks.push(buf.subarray(0, needed))
      written += needed
    }
    const outFile = '/tmp/test-output.pcm'
    writeFileSync(outFile, Buffer.concat(outChunks))
    console.log(`Written ${written} bytes to ${outFile}`)
    console.log('Convert with: ffmpeg -f s16le -ar 48000 -ac 2 -i /tmp/test-output.pcm /tmp/test-output.wav')
  }
})

demuxer.on('error', (err) => {
  console.error('Demuxer error:', err)
})

// HTTP download
console.log('Starting HTTP download...')
const opts = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://www.youtube.com',
  },
}
https.get(uri, opts, (res) => {
  if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    console.log(`Redirect to ${res.headers.location}`)
    res.destroy()
    return
  }
  if (res.statusCode !== 200) {
    console.error(`HTTP ${res.statusCode}`)
    return
  }
  console.log('HTTP 200 OK')
  res.pipe(demuxer)
}).on('error', (err) => {
  console.error('HTTP error:', err)
})
