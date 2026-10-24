import { describe, expect, it } from 'vitest'
import { hasRemoteMatch } from 'next/dist/shared/lib/match-remote-pattern'

const config = require('../../next.config.js')
const allowed = (url: string) => hasRemoteMatch([], config.images.remotePatterns, new URL(url))

describe('image optimizer outbound request boundary', () => {
  it.each([
    'https://res.cloudinary.com/fixture/image/upload/photo.jpg',
    'https://images.unsplash.com/photo-fixture',
    'https://placehold.co/100x100',
    'https://i.pravatar.cc/40',
  ])('retains existing image consumer %s', url => expect(allowed(url)).toBe(true))

  it.each([
    'https://169.254.169.254/latest/meta-data/',
    'https://127.0.0.1/api/internal/readiness',
    'https://localhost/admin',
    'https://attacker.example/image.svg',
    'https://res.cloudinary.com.attacker.example/image.jpg',
    'http://res.cloudinary.com/image.jpg',
    'https://res.cloudinary.com:8443/image.jpg',
  ])('refuses untrusted or internal image source %s', url => expect(allowed(url)).toBe(false))
})
