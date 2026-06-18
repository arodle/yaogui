import crypto from 'node:crypto'

export interface OssPolicy {
  host: string
  key: string
  url: string
  formData: Record<string, string>
  expiresAt: string
}

const SIGNED_READ_TTL_SECONDS = 60 * 30

function trimSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function getOssHost(bucket: string, region?: string, endpoint?: string) {
  if (endpoint) {
    const normalized = endpoint.replace(/^https?:\/\//, '')
    return `https://${bucket}.${normalized}`
  }

  if (!region) {
    throw new Error('Missing OSS_REGION or OSS_ENDPOINT.')
  }

  return `https://${bucket}.oss-${region}.aliyuncs.com`
}

function getFileExtension(fileName?: string, contentType?: string) {
  const fromName = fileName?.match(/\.([a-z0-9]+)$/i)?.[1]
  if (fromName) return fromName.toLowerCase()

  const subtype = contentType?.split('/')[1]?.split(';')[0]
  if (!subtype) return 'jpg'
  if (subtype === 'jpeg') return 'jpg'
  return subtype.toLowerCase()
}

function formatAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

function hmac(key: crypto.BinaryLike | crypto.KeyObject, value: string, encoding?: crypto.BinaryToTextEncoding) {
  const digest = crypto.createHmac('sha256', key).update(value).digest()
  return encoding ? digest.toString(encoding) : digest
}

function getS3SigningKey(secret: string, dateStamp: string, region: string) {
  const dateKey = hmac(`AWS4${secret}`, dateStamp)
  const regionKey = hmac(dateKey, region)
  const serviceKey = hmac(regionKey, 's3')
  return hmac(serviceKey, 'aws4_request')
}

function hash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

function canonicalQuery(params: Record<string, string>) {
  return Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

export function getOssObjectKey(urlOrKey: string) {
  if (!urlOrKey || urlOrKey.startsWith('data:image/')) return null

  try {
    const parsed = new URL(urlOrKey)
    const bucket = process.env.OSS_BUCKET
    const endpoint = process.env.OSS_ENDPOINT
    const host = bucket && endpoint ? new URL(getOssHost(bucket, undefined, endpoint)).host : ''
    const publicHost = process.env.OSS_PUBLIC_BASE_URL ? new URL(process.env.OSS_PUBLIC_BASE_URL).host : ''

    if (parsed.host === host || parsed.host === publicHost) {
      return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
    }

    return null
  } catch {
    return urlOrKey.replace(/^\/+/, '')
  }
}

export function createSignedOssReadUrl(urlOrKey: string) {
  const key = getOssObjectKey(urlOrKey)
  if (!key) return urlOrKey

  const accessKeyId = process.env.OSS_ACCESS_KEY_ID
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET
  const bucket = process.env.OSS_BUCKET

  if (!accessKeyId || !accessKeySecret || !bucket) return urlOrKey

  const region = process.env.OSS_REGION || process.env.S3_REGION || 'st-sh-01'
  const host = getOssHost(bucket, process.env.OSS_REGION, process.env.OSS_ENDPOINT)
  const now = new Date()
  const amzDate = formatAmzDate(now)
  const dateStamp = amzDate.slice(0, 8)
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
  const signedHeaders = 'host'
  const params: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(SIGNED_READ_TTL_SECONDS),
    'X-Amz-SignedHeaders': signedHeaders
  }
  const url = new URL(`${host}/${encodePath(key)}`)
  const canonicalRequest = [
    'GET',
    url.pathname,
    canonicalQuery(params),
    `host:${url.host}\n`,
    signedHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hash(canonicalRequest)
  ].join('\n')
  const signature = hmac(getS3SigningKey(accessKeySecret, dateStamp, region), stringToSign, 'hex') as string

  params['X-Amz-Signature'] = signature
  url.search = canonicalQuery(params)
  return url.toString()
}

export function normalizeOssStorageUrl(urlOrKey: string | null | undefined) {
  if (!urlOrKey) return null
  const key = getOssObjectKey(urlOrKey)
  if (!key) return urlOrKey

  const bucket = process.env.OSS_BUCKET
  const host = bucket ? getOssHost(bucket, process.env.OSS_REGION, process.env.OSS_ENDPOINT) : ''
  const publicBaseUrl = process.env.OSS_PUBLIC_BASE_URL
    ? trimSlash(process.env.OSS_PUBLIC_BASE_URL)
    : host

  return `${publicBaseUrl}/${key}`
}

export function createOssPolicy(userId: string, body: { fileName?: string; contentType?: string; directory?: string }): OssPolicy {
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET
  const bucket = process.env.OSS_BUCKET

  if (!accessKeyId || !accessKeySecret || !bucket) {
    throw new Error('OSS is not configured. Missing OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, or OSS_BUCKET.')
  }

  const maxSizeMb = Number(process.env.OSS_MAX_SIZE_MB || 8)
  const rootDir = (body.directory || process.env.OSS_UPLOAD_DIR || 'yaogui').replace(/^\/+|\/+$/g, '')
  const extension = getFileExtension(body.fileName, body.contentType)
  const randomId = crypto.randomBytes(12).toString('hex')
  const key = `${rootDir}/${userId}/${Date.now()}-${randomId}.${extension}`
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')
  const host = getOssHost(bucket, process.env.OSS_REGION, process.env.OSS_ENDPOINT)
  const region = process.env.OSS_REGION || process.env.S3_REGION || 'st-sh-01'
  const now = new Date()
  const amzDate = formatAmzDate(now)
  const dateStamp = amzDate.slice(0, 8)
  const credential = `${accessKeyId}/${dateStamp}/${region}/s3/aws4_request`
  const contentType = body.contentType || 'image/jpeg'

  const policy = Buffer.from(JSON.stringify({
    expiration: expiresAt,
    conditions: [
      { bucket },
      { 'x-amz-algorithm': 'AWS4-HMAC-SHA256' },
      { 'x-amz-credential': credential },
      { 'x-amz-date': amzDate },
      ['content-length-range', 1, maxSizeMb * 1024 * 1024],
      ['starts-with', '$key', `${rootDir}/${userId}/`],
      ['starts-with', '$Content-Type', contentType.split('/')[0] + '/']
    ]
  })).toString('base64')

  const signature = hmac(getS3SigningKey(accessKeySecret, dateStamp, region), policy, 'hex') as string

  const publicBaseUrl = process.env.OSS_PUBLIC_BASE_URL
    ? trimSlash(process.env.OSS_PUBLIC_BASE_URL)
    : host

  return {
    host,
    key,
    url: `${publicBaseUrl}/${key}`,
    expiresAt,
    formData: {
      key,
      policy,
      'Content-Type': contentType,
      'x-amz-algorithm': 'AWS4-HMAC-SHA256',
      'x-amz-credential': credential,
      'x-amz-date': amzDate,
      'x-amz-signature': signature,
      success_action_status: '201'
    }
  }
}
