#!/usr/bin/env node

import fs, { createReadStream, createWriteStream } from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'

async function splitFile(inputFile, output1, output2) {
  // Validate input file
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file "${inputFile}" not found.`)
    process.exit(1)
  }

  // Default output names
  const baseName = path.basename(inputFile, path.extname(inputFile))
  const dirName = path.dirname(inputFile)
  output1 =
    output1 || path.join(dirName, `${baseName}_part1${path.extname(inputFile)}`)
  output2 =
    output2 || path.join(dirName, `${baseName}_part2${path.extname(inputFile)}`)

  console.log(`Splitting "${inputFile}" into:`)
  console.log(`  ${output1}`)
  console.log(`  ${output2}`)

  // Get total size
  const stats = await fs.promises.stat(inputFile)
  const totalSize = stats.size
  const halfSize = Math.ceil(totalSize / 2)

  console.log(
    `Total size: ${totalSize} bytes, first part will be ${halfSize} bytes.`
  )

  // Create read stream and two write streams
  const readStream = createReadStream(inputFile)
  const ws1 = createWriteStream(output1)
  const ws2 = createWriteStream(output2)

  let bytesWritten = 0

  // Pipe first half to ws1, second half to ws2
  await new Promise((resolve, reject) => {
    readStream.on('data', (chunk) => {
      const remaining = halfSize - bytesWritten
      if (remaining <= 0) {
        // All bytes for first part already sent, write to second
        ws2.write(chunk)
      } else if (chunk.length <= remaining) {
        // Whole chunk goes to first part
        ws1.write(chunk)
        bytesWritten += chunk.length
      } else {
        // Split chunk: first part gets `remaining` bytes, rest to second
        ws1.write(chunk.slice(0, remaining))
        ws2.write(chunk.slice(remaining))
        bytesWritten = halfSize
      }
    })

    readStream.on('end', () => {
      ws1.end()
      ws2.end()
      resolve()
    })

    readStream.on('error', reject)
    ws1.on('error', reject)
    ws2.on('error', reject)
  })

  console.log('Done.')
}

// Parse arguments
const args = process.argv.slice(2)
if (args.length < 1) {
  console.error(
    'Usage: node split-file.js <input-file> [output-file1] [output-file2]'
  )
  process.exit(1)
}

splitFile(args[0], args[1], args[2])
