import fs from 'fs'
import path from 'path'

export default {
  base: '/TempoNetVR/',
  build: {
    outDir: 'docs',
    target: 'esnext',
    supported: {
      'top-level-await': true
    }
  },
  server: {
    open: true,
    host: '0.0.0.0',
    port: 5173,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, 'localhost-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, 'localhost.pem'))
    }
  }
}