import express from 'express'
import cors from 'cors'

const app = express()
app.use(express.json())
app.use(cors())

app.get('/items', (req, res) => {
  res.json([
    { id: 1, name: 'Juego Zelda' },
    { id: 2, name: 'Consola Switch' },
  ])
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Servidor backend escuchando en puerto ${PORT}`))
