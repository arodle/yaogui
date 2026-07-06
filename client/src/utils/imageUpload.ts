import { api } from '../api'

const MAX_IMAGE_SIZE = 1024
const IMAGE_QUALITY = 0.72

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('图片压缩失败'))
    }, type, quality)
  })
}

async function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('图片读取失败'))
    }
    image.src = objectUrl
  })
}

export async function compressImage(file: File) {
  const image = await loadImage(file)
  const width = image.naturalWidth
  const height = image.naturalHeight
  const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(width, height))
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')

  canvas.width = targetWidth
  canvas.height = targetHeight
  canvas.getContext('2d')?.drawImage(image, 0, 0, targetWidth, targetHeight)

  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await canvasToBlob(canvas, type, type === 'image/png' ? 0.9 : IMAGE_QUALITY)

  if (blob.size >= file.size && file.size <= 1024 * 1024) {
    return file
  }

  return new File([blob], file.name.replace(/\.[^.]+$/, type === 'image/png' ? '.png' : '.jpg'), {
    type,
    lastModified: Date.now()
  })
}

export async function uploadImageToOss(file: File, directory = 'medicine-photos') {
  if (api.isDemo()) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (event) => resolve((event.target?.result as string) || '')
      reader.onerror = () => reject(new Error('图片读取失败'))
      reader.readAsDataURL(file)
    })
  }

  const image = await compressImage(file)
  const policy = await api.uploads.createPolicy({
    fileName: image.name,
    contentType: image.type,
    directory
  })

  const formData = new FormData()
  Object.entries(policy.formData as Record<string, string>).forEach(([key, value]) => {
    formData.append(key, value)
  })
  formData.append('file', image)

  const response = await fetch(policy.host, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    throw new Error('图片上传 OSS 失败')
  }

  return policy.url as string
}
