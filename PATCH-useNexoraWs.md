# hooks/useNexoraWs.ts — 5 alterações

1. Na interface `NexoraWsCallbacks`, acrescenta:
```ts
  onTicksSnapshot?: (symbol: string, prices: number[], pipSize?: number) => void
```

2. A seguir a `const watchdogRef = ...`, acrescenta:
```ts
  const tickReqRef = useRef<{ symbol: string; count: number } | null>(null)
  const authedRef = useRef(false)
```

3. No `switch`, antes de `case 'authenticated':`, acrescenta:
```ts
        case 'ticks_snapshot': {
          const p = payload as { symbol?: string; prices?: number[]; pip_size?: number }
          if (p.symbol && Array.isArray(p.prices)) cbRef.current.onTicksSnapshot?.(p.symbol, p.prices, p.pip_size)
          break
        }
```
   Atenção: o servidor envia `{ type: 'ticks_snapshot', payload: {...} }`.
   Se o teu `switch` lê `payload` de outra forma, usa o mesmo padrão dos outros cases.

4. Em `case 'authenticated':`, a seguir a `rateLimitedRef.current = false`:
```ts
          authedRef.current = true
          if (tickReqRef.current) send('subscribe_ticks', tickReqRef.current)
```
   Em `ws.onclose`, a seguir a `setWsStatus('disconnected')`:
```ts
    authedRef.current = false
```

5. No `return { ... }` do hook:
```ts
    subscribeTicks: useCallback((symbol: string, count = 1000) => {
      tickReqRef.current = { symbol, count }
      if (authedRef.current) send('subscribe_ticks', { symbol, count })
    }, [send]),
    unsubscribeTicks: useCallback(() => {
      tickReqRef.current = null
      send('unsubscribe_ticks')
    }, [send]),
```
   `send` tem de ser estável (useCallback). Se mudar a cada render, o
   useEffect do BotsContext vai re-subscrever em loop.
