export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function done(name: string) {
  console.log(`[PASS] ${name}`)
}
