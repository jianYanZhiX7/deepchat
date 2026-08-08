import { z } from 'zod'
import { TimestampMsSchema, defineEventContract } from '../common'
import {
  OpenAICodexAuthStatusSchema,
  XaiGrokAuthStatusSchema,
  AigotokenAuthStatusSchema
} from '../routes/oauth.routes'

export const oauthOpenAICodexStatusChangedEvent = defineEventContract({
  name: 'oauth.openaiCodex.statusChanged',
  payload: z.object({
    status: OpenAICodexAuthStatusSchema,
    version: TimestampMsSchema
  })
})

export const oauthXaiGrokStatusChangedEvent = defineEventContract({
  name: 'oauth.xaiGrok.statusChanged',
  payload: z.object({
    status: XaiGrokAuthStatusSchema,
    version: TimestampMsSchema
  })
})

export const oauthAigotokenStatusChangedEvent = defineEventContract({
  name: 'oauth.aigotoken.statusChanged',
  payload: z.object({
    status: AigotokenAuthStatusSchema,
    version: TimestampMsSchema
  })
})
