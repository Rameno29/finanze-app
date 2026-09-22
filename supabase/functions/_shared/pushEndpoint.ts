/** A stored endpoint is untrusted user input, never a general-purpose server-side URL. */
export function allowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash &&
      ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(url.hostname)
  } catch { return false }
}
