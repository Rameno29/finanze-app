import { expect, it } from 'vitest'
import { allowedPushEndpoint } from './pushEndpoint'
it('allows known HTTPS push services, not arbitrary URLs or lookalike hosts', () => {
  for (const url of ['https://fcm.googleapis.com/fcm/send/abc','https://updates.push.services.mozilla.com/wpush/v2/abc','https://web.push.apple.com/abc']) expect(allowedPushEndpoint(url)).toBe(true)
  for (const url of ['http://fcm.googleapis.com/x','https://127.0.0.1/a','https://169.254.169.254/','https://fcm.googleapis.com.evil.test/a','https://user:pass@fcm.googleapis.com/a','https://fcm.googleapis.com:8443/a','not-url']) expect(allowedPushEndpoint(url)).toBe(false)
})
