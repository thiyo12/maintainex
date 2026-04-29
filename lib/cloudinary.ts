import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'ddt2rqfe1',
  api_key: process.env.CLOUDINARY_API_KEY || '273983623944158',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'wqzJvZQFYx9z9ogg49rNvRw4IrQ'
})

export async function uploadToCloudinary(
  buffer: Buffer, 
  folder: string, 
  filename?: string
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `maintainex/${folder}`,
        public_id: filename?.replace(/\.[^/.]+$/, ''),
        resource_type: 'image',
        transformation: [
          { quality: 'auto', fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error)
          reject(error)
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id
          })
        } else {
          reject(new Error('No result from Cloudinary'))
        }
      }
    )
    
    uploadStream.end(buffer)
  })
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export function getCloudinaryUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return ''
}