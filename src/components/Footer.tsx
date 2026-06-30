import { useState, useEffect } from 'react'
import { useTrading } from '../context/TradingContext'

export function Footer() {
  const { isConnected } = useTrading()
  const [currentTime, setCurrentTime] = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      const p = (n: number) => String(n).padStart(2, '0')
      setCurrentTime(
        `${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())} ${p(now.getUTCHours())}:${p(now.getUTCMinutes())}:${p(now.getUTCSeconds())} GMT`
      )
    }
    update()
    const i = setInterval(update, 1000)
    return () => clearInterval(i)
  }, [])

  return (
    <div className="card" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      padding: '10px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={`dot ${isConnected ? 'live' : 'off'}`} />
        <span style={{ color: 'var(--white)', fontWeight: 500, fontSize: 13 }}>Deriv</span>
        <span style={{ fontSize: 12, color: isConnected ? 'var(--text-dim)' : 'var(--red-hi)' }}>
          {isConnected ? 'Conectado' : 'Desconectado'}
        </span>
      </div>
      <div className="tabular" style={{ color: 'var(--text-dim)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        {currentTime}
      </div>
    </div>
  )
}
