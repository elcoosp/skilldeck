export default async function globalSetup() {
  // Default to localhost:9222; can be overridden by CI or local .env
  process.env.CDP_ENDPOINT_URL = process.env.CDP_ENDPOINT_URL || 'http://127.0.0.1:9222';
}
