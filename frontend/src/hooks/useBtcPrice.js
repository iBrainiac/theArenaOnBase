import { useState, useEffect } from 'react'

export function useBtcPrice() {
  const [price, setPriceState]  = useState(null)
  const [prev, setPrev]         = useState(null)
  const [isFlashing, setFlash]  = useState(false)

  useEffect(() => {
    async function fetchPrice() {
      try {
        const res  = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot')
        const data = await res.json()
        const next = parseFloat(data.data.amount)

        setPriceState(cur => {
          if (cur !== null && cur !== next) {
            setPrev(cur)
            setFlash(true)
            setTimeout(() => setFlash(false), 180)
          }
          return next
        })
      } catch { /* network blip — keep last price */ }
    }

    fetchPrice()
    const id = setInterval(fetchPrice, 20_000)
    return () => clearInterval(id)
  }, [])

  const pct = price && prev ? ((price - prev) / prev) * 100 : 0

  return { price, isFlashing, pct }
}
