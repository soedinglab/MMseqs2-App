/**
 * Throttle function
 * @param {Function} func - function to be applied throttle
 * @param {number} delay - delay in ms unit
 * @returns {Function} - new function with throttle
 */
export function throttle(func, delay) {
  let lastCallTime = 0;

  return function (...args) {
    const context = this;
    const now = Date.now();

    if (now - lastCallTime >= delay) {
      lastCallTime = now;
      func.apply(context, args);
    }
  };
}
