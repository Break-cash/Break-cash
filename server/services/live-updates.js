const clients = new Map()
let nextClientId = 1

function safeJsonWrite(res, payload) {
  try {
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  } catch {
    // client stream is likely closed
  }
}

export function subscribeLiveClient({ userId, res }) {
  const id = nextClientId++
  const client = {
    id,
    userId: Number(userId || 0),
    res,
    heartbeatId: null,
  }
  clients.set(id, client)
  client.heartbeatId = setInterval(() => {
    try {
      res.write(': keep-alive\n\n')
    } catch {
      // ignore write errors, cleanup will happen on close
    }
  }, 25000)
  return () => {
    const current = clients.get(id)
    if (!current) return
    clients.delete(id)
    if (current.heartbeatId) clearInterval(current.heartbeatId)
  }
}

export function publishLiveUpdate(event) {
  const payload = {
    type: String(event?.type || 'unknown'),
    scope: event?.scope === 'user' ? 'user' : 'global',
    userId: Number(event?.userId || 0) || undefined,
    source: String(event?.source || ''),
    key: String(event?.key || ''),
    title: typeof event?.title === 'string' ? String(event.title).slice(0, 180) : undefined,
    body: typeof event?.body === 'string' ? String(event.body).slice(0, 500) : undefined,
    vibrate: Boolean(event?.vibrate),
    ts: Date.now(),
  }
  for (const client of clients.values()) {
    if (payload.scope === 'user' && payload.userId && client.userId !== payload.userId) continue
    safeJsonWrite(client.res, payload)
  }
}
