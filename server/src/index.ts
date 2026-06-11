import express from 'express'
import cors from 'cors'
import { authRouter } from './routes/auth.js'
import { medicineRouter } from './routes/medicine.js'
import { recordRouter } from './routes/record.js'
import { reminderRouter } from './routes/reminder.js'
import { familyRouter } from './routes/family.js'
import { authMiddleware } from './middleware/auth.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRouter)

app.use('/api/medicines', authMiddleware, medicineRouter)
app.use('/api/records', authMiddleware, recordRouter)
app.use('/api/reminders', authMiddleware, reminderRouter)
app.use('/api/family', authMiddleware, familyRouter)

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
