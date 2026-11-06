# context/BotsContext.tsx — 3 alterações

1. A seguir a `const MAX_TRADES = 300`:
```ts
const CHART_SYMBOL = '1HZ100V'
```

2. A seguir a `handleTick`:
```ts
  const handleTicksSnapshot = useCallback((symbol: string, prices: number[], pipSize?: number) => {
    trading._setTicksSnapshot(symbol, prices, pipSize)
  }, [trading._setTicksSnapshot])
```

3. Em `useNexoraWs({ ... })` acrescenta `onTicksSnapshot: handleTicksSnapshot,`
   e, a seguir a `const ws = ...`:
```ts
  useEffect(() => { ws.subscribeTicks(CHART_SYMBOL, 1000) }, [ws.subscribeTicks])
```
   O `handleTick` existente deve chamar `trading._setTick(quote, pipSize, symbol)`
   com os 3 argumentos, senão o filtro de símbolo não funciona.
