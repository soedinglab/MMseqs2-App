const config = {
  selector: `vue-portal-target`,
}
export default config

export const setSelector = selector => (config.selector = selector)

export const isBrowser =
  typeof window !== 'undefined' && typeof document !== undefined
