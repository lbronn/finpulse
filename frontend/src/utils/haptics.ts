/**
 * Summary: Haptic feedback utilities using the Web Vibration API.
 * Falls back silently on devices/browsers that don't support vibration.
 */

export function hapticLight(): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
}

export function hapticMedium(): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(25);
  }
}

export function hapticSuccess(): void {
  if ('vibrate' in navigator) {
    navigator.vibrate([10, 50, 10]);
  }
}
