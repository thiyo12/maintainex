export interface StorageProvider {
  upload(key: string, data: Buffer, contentType: string): Promise<{ url: string; key: string }>
  download(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  getSignedUrl(key: string, expiresIn?: number): Promise<string>
}

export interface StorageConfig {
  provider: 'local' | 's3' | 'cloudinary'
  bucket?: string
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  endpoint?: string
  basePath?: string
}

export function createStorageProvider(config?: StorageConfig): StorageProvider {
  const provider = config?.provider || process.env.STORAGE_PROVIDER || 'local'

  switch (provider) {
    case 's3':
      return createS3Storage(config)
    case 'cloudinary':
      return createCloudinaryStorage(config)
    default:
      return createLocalStorage(config)
  }
}

function createLocalStorage(config?: StorageConfig): StorageProvider {
  const fs = require('fs').promises
  const path = require('path')
  const basePath = config?.basePath || process.cwd()

  return {
    async upload(key: string, data: Buffer, contentType: string): Promise<{ url: string; key: string }> {
      const fullPath = path.join(basePath, 'public', key)
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      await fs.writeFile(fullPath, data)
      return { url: `/${key}`, key }
    },

    async download(key: string): Promise<Buffer> {
      const fullPath = path.join(basePath, 'public', key)
      return await fs.readFile(fullPath)
    },

    async delete(key: string): Promise<void> {
      const fullPath = path.join(basePath, 'public', key)
      await fs.unlink(fullPath)
    },

    async exists(key: string): Promise<boolean> {
      const fullPath = path.join(basePath, 'public', key)
      try {
        await fs.access(fullPath)
        return true
      } catch {
        return false
      }
    },

    async getSignedUrl(key: string, expiresIn?: number): Promise<string> {
      return `/${key}`
    },
  }
}

function createS3Storage(config?: StorageConfig): StorageProvider {
  return {
    async upload(key: string, data: Buffer, contentType: string): Promise<{ url: string; key: string }> {
      throw new Error('S3 storage not implemented')
    },
    async download(key: string): Promise<Buffer> {
      throw new Error('S3 storage not implemented')
    },
    async delete(key: string): Promise<void> {
      throw new Error('S3 storage not implemented')
    },
    async exists(key: string): Promise<boolean> {
      throw new Error('S3 storage not implemented')
    },
    async getSignedUrl(key: string, expiresIn?: number): Promise<string> {
      throw new Error('S3 storage not implemented')
    },
  }
}

function createCloudinaryStorage(config?: StorageConfig): StorageProvider {
  return {
    async upload(key: string, data: Buffer, contentType: string): Promise<{ url: string; key: string }> {
      throw new Error('Cloudinary storage not implemented')
    },
    async download(key: string): Promise<Buffer> {
      throw new Error('Cloudinary storage not implemented')
    },
    async delete(key: string): Promise<void> {
      throw new Error('Cloudinary storage not implemented')
    },
    async exists(key: string): Promise<boolean> {
      throw new Error('Cloudinary storage not implemented')
    },
    async getSignedUrl(key: string, expiresIn?: number): Promise<string> {
      throw new Error('Cloudinary storage not implemented')
    },
  }
}
