/** At most one automatic update per song and one check per URL per minute. */
const attempted = new Set<string>()
const lastChecks = new Map<string, number>()

export const runSubscriptionRecovery = async<T>(options: {
  url: string
  songKey: string
  fetchAndUpdate: () => Promise<boolean>
  retry: () => Promise<T>
}): Promise<T | undefined> => {
  const url = options.url.trim()
  if (!url || !options.songKey) return undefined
  const key = `${url}\n${options.songKey}`
  const now = Date.now()
  if (attempted.has(key) || now - (lastChecks.get(url) ?? -Infinity) < 60_000) return undefined
  attempted.add(key)
  lastChecks.set(url, now)
  if (attempted.size > 200) attempted.delete(attempted.values().next().value!)
  if (lastChecks.size > 20) lastChecks.delete(lastChecks.keys().next().value!)
  let updated = false
  try {
    updated = await options.fetchAndUpdate()
  } catch {
    return undefined
  }
  if (!updated) return undefined
  return options.retry()
}
