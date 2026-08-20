import { describe, expect, it, vi } from 'vitest'
import { analyzeFrame, shouldOfferReEnrollment, shouldRedirectToEnrollment } from '../screens/Verify.jsx'

describe('camera frame analysis', () => {
  it('samples the center of the frame instead of the top-left corner', () => {
    const pixels = new Uint8ClampedArray(160 * 160 * 4).fill(120)
    const getImageData = vi.fn(() => ({ data: pixels }))
    const canvas = {
      width: 720,
      height: 720,
      getContext: () => ({ getImageData }),
    }

    const result = analyzeFrame(canvas)

    expect(getImageData).toHaveBeenCalledWith(280, 280, 160, 160)
    expect(result.hasEnoughLight).toBe(true)
  })
})

// Regression: the old top-left sample could measure a dark background instead of the face.

describe('attendance enrollment recovery', () => {
  it('redirects missing biometric enrollment back to enrollment', () => {
    expect(shouldRedirectToEnrollment(409, 'Your attendance face enrollment is unavailable. Re-enroll your face before recording attendance.', false)).toBe(true)
    expect(shouldRedirectToEnrollment(409, 'Enroll your face before recording attendance.', false)).toBe(true)
    expect(shouldRedirectToEnrollment(409, 'Attendance already recorded for today.', false)).toBe(false)
    expect(shouldRedirectToEnrollment(422, 'Face verification failed.', false)).toBe(false)
    expect(shouldRedirectToEnrollment(409, 'Re-enroll your face.', true)).toBe(false)
    expect(shouldOfferReEnrollment(422, 'Face verification failed. Try again with the enrolled employee centered in the frame.', false)).toBe(true)
    expect(shouldOfferReEnrollment(422, 'No usable face was detected.', false)).toBe(false)
    expect(shouldOfferReEnrollment(422, 'Face verification failed.', true)).toBe(false)
  })
})
