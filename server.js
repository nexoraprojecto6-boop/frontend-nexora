// Servidor estático simples para produção no Render.
// Serve o build do Vite (pasta dist) e redireciona todas as
// rotas não encontradas para index.html (SPA routing).
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const distPath = path.join(__dirname, 'dist')

app.use(express.static(distPath))

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

const PORT = process.env.PORT || 4173
app.listen(PORT, () => {
  console.log(`Nexora frontend a correr na porta ${PORT}`)
})
