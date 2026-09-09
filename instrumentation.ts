export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureSecretsValidated } = await import('./lib/config/env-validation')
    ensureSecretsValidated()
  }
}
