import process from 'node:process'
import { resolve } from 'node:path'
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(resolve(process.cwd(), '..', '.env'))
}

const prisma = new PrismaClient()

function trimSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function getHost(bucket: string, endpoint: string) {
  const normalized = endpoint.replace(/^https?:\/\//, '')
  return `https://${bucket}.${normalized}`
}

function formatAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

function hash(value: string | Buffer) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function hmac(key: crypto.BinaryLike | crypto.KeyObject, value: string, encoding?: crypto.BinaryToTextEncoding) {
  const digest = crypto.createHmac('sha256', key).update(value).digest()
  return encoding ? digest.toString(encoding) : digest
}

function getSigningKey(secret: string, dateStamp: string, region: string) {
  const dateKey = hmac(`AWS4${secret}`, dateStamp)
  const regionKey = hmac(dateKey, region)
  const serviceKey = hmac(regionKey, 's3')
  return hmac(serviceKey, 'aws4_request')
}

function parseDataUrl(value: string) {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return null

  const contentType = match[1]
  const extension = contentType.split('/')[1] === 'jpeg' ? 'jpg' : contentType.split('/')[1]
  return {
    contentType,
    extension,
    buffer: Buffer.from(match[2], 'base64')
  }
}

async function putObject(key: string, body: Buffer, contentType: string) {
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET
  const bucket = process.env.OSS_BUCKET
  const endpoint = process.env.OSS_ENDPOINT
  const region = process.env.OSS_REGION || 'st-sh-01'

  if (!accessKeyId || !accessKeySecret || !bucket || !endpoint) {
    throw new Error('Missing OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET, or OSS_ENDPOINT.')
  }

  const host = getHost(bucket, endpoint)
  const url = new URL(`${host}/${key}`)
  const now = new Date()
  const amzDate = formatAmzDate(now)
  const dateStamp = amzDate.slice(0, 8)
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
  const payloadHash = hash(body)
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${url.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ].join('\n') + '\n'
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = [
    'PUT',
    url.pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hash(canonicalRequest)
  ].join('\n')
  const signature = hmac(getSigningKey(accessKeySecret, dateStamp, region), stringToSign, 'hex') as string
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate
    },
    body: new Uint8Array(body)
  })

  if (!response.ok) {
    throw new Error(`AOSS upload failed: ${response.status} ${await response.text()}`)
  }

  const publicBaseUrl = process.env.OSS_PUBLIC_BASE_URL
    ? trimSlash(process.env.OSS_PUBLIC_BASE_URL)
    : host

  return `${publicBaseUrl}/${key}`
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const medicines = await prisma.medicine.findMany({
    where: { photo: { startsWith: 'data:image/' } },
    select: { id: true, name: true, photo: true }
  })

  console.log(`Found ${medicines.length} medicine photos to migrate.`)

  for (const medicine of medicines) {
    const parsed = parseDataUrl(medicine.photo || '')
    if (!parsed) continue

    const key = `medicine-photos/migrated/${medicine.id}-${Date.now()}.${parsed.extension}`
    if (dryRun) {
      console.log(`[dry-run] ${medicine.name} -> ${key} (${parsed.buffer.length} bytes)`)
      continue
    }

    const url = await putObject(key, parsed.buffer, parsed.contentType)
    await prisma.medicine.update({
      where: { id: medicine.id },
      data: { photo: url }
    })
    console.log(`Migrated ${medicine.name}: ${url}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
