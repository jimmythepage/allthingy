/**
 * Resize resources/icon.png to 512x512 and write resources/icon-512.png.
 * electron-builder requires at least 512x512 for app icons.
 * Uses Jimp (pure JS, no native bindings) so it runs on any CI.
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
    const { Jimp } = require('jimp')
    const image = await Jimp.read(inputPath)
    image.resize({ w: 512, h: 512 })
    await image.write(outputPath)
    console.log('Created resources/icon-512.png (512x512)')
  } catch (err) {
    console.error('Resize failed:', err.message)
    process.exit(1)
  }
})()
