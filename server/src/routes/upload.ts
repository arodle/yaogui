import { Router, Response } from 'express'
import { AuthRequest } from '../middleware/auth.js'
import { createOssPolicy } from '../lib/oss.js'

const router = Router()

router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' })
    }

    return res.json(createOssPolicy(userId, req.body || {}))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create upload policy.'
    return res.status(500).json({ error: message })
  }
})

export { router as uploadRouter }
