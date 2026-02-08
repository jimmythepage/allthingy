/**
 * Resize resources/icon.png to 512x512 and write resources/icon-512.png.
 * electron-builder requires at least 512x512 for app icons.
 * Run before dist:mac / dist:win (or CI does it).
 */
const path = require('path')
const fs = require('fs')

const inputPath = path.join(__dirname, '..', 'resources', 'icon.png')
const outputPath = path.join(__dirname, '..', 'resources', 'icon-512.png')

if (!fs.existsSync(inputPath)) {
  console.error('resources/icon.png not found')
  process.exit(1)
}

;(async () => {
  try {
    const sharp = require('sharp')
    await sharp(inputPath)
      .resize(512, 512)
      .png()
      .toFile(outputPath)
    console.log('Created resources/icon-512.png (512x512)')
  } catch (err) {
    console.error('Resize failed:', err.message)
    process.exit(1)
  }
})()
