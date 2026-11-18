import { useEffect, useRef } from 'react'

interface Props { prices: number[]; pip: number; barrier?: number | null }

/** Gráfico de área de ticks em canvas (sem dependências, redesenha por tick). */
export function PriceChart({ prices, pip, barrier }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = c.clientWidth, h = c.clientHeight
      if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr }
      const g = c.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      const n = prices.length
      if (n < 2) return
      const css = getComputedStyle(document.documentElement)
      const blue = css.getPropertyValue('--blue-hi').trim() || '#4f8bff'
      const grid = css.getPropertyValue('--border').trim() || '#232a35'
      const faint = css.getPropertyValue('--text-faint').trim() || '#7e8896'
      const amber = css.getPropertyValue('--amber').trim() || '#f0b90b'

      const PR = 64, PY = 14
      const all = barrier != null ? [...prices, barrier] : prices
      let lo = Math.min(...all), hi = Math.max(...all)
      if (hi === lo) { hi += 1; lo -= 1 }
      const pad = (hi - lo) * 0.1; lo -= pad; hi += pad
      const x = (i: number) => (i / (n - 1)) * (w - PR)
      const y = (v: number) => h - PY - ((v - lo) / (hi - lo)) * (h - PY * 2)

      g.font = '11px ' + (css.getPropertyValue('--font-mono').trim() || 'monospace')
      g.textBaseline = 'middle'
      for (let k = 0; k <= 4; k++) {
        const v = lo + ((hi - lo) * k) / 4, yy = y(v)
        g.strokeStyle = grid; g.lineWidth = 1
        g.beginPath(); g.moveTo(0, yy); g.lineTo(w - PR, yy); g.stroke()
        g.fillStyle = faint; g.fillText(v.toFixed(pip), w - PR + 8, yy)
      }

      const grad = g.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, 'rgba(79,139,255,0.28)'); grad.addColorStop(1, 'rgba(79,139,255,0)')
      g.beginPath(); g.moveTo(x(0), y(prices[0]))
      prices.forEach((p, i) => g.lineTo(x(i), y(p)))
      g.lineTo(x(n - 1), h); g.lineTo(0, h); g.closePath(); g.fillStyle = grad; g.fill()
      g.beginPath(); prices.forEach((p, i) => (i ? g.lineTo(x(i), y(p)) : g.moveTo(x(i), y(p))))
      g.strokeStyle = blue; g.lineWidth = 1.5; g.lineJoin = 'round'; g.stroke()

      if (barrier != null) {
        const yb = y(barrier)
        g.setLineDash([5, 4]); g.strokeStyle = amber; g.beginPath()
        g.moveTo(0, yb); g.lineTo(w - PR, yb); g.stroke(); g.setLineDash([])
        g.fillStyle = amber; g.fillText(barrier.toFixed(pip), w - PR + 8, yb)
      }

      const last = prices[n - 1], yl = y(last)
      g.fillStyle = blue; g.beginPath(); g.arc(x(n - 1), yl, 3.5, 0, Math.PI * 2); g.fill()
      g.fillRect(w - PR + 2, yl - 10, PR - 4, 20)
      g.fillStyle = '#fff'; g.fillText(last.toFixed(pip), w - PR + 8, yl)
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(c)
    return () => ro.disconnect()
  }, [prices, pip, barrier])

  return (
    <div className="mt-canvas-wrap">
      <canvas ref={ref} className="mt-canvas" aria-label="Gráfico de preços em tempo real" />
    </div>
  )
}
