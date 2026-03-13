import { useEffect, useRef } from 'react'
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'

type Candle = {
  time: number
  open: number
  high: number
  low: number
  close: number
}

type LiveCandlesChartProps = {
  candles: Candle[]
}

export function LiveCandlesChart({ candles }: LiveCandlesChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0b1020' }, textColor: '#c2c8d6' },
      grid: { vertLines: { color: '#1a2236' }, horzLines: { color: '#1a2236' } },
      rightPriceScale: { borderColor: '#25304a' },
      timeScale: { borderColor: '#25304a', timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: '#2fce7f' }, horzLine: { color: '#2fce7f' } },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    chartRef.current = chart
    seriesRef.current = series

    const onResize = () => {
      if (!containerRef.current || !chartRef.current) return
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth, height: 300 })
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return
    seriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    )
    chartRef.current.timeScale().fitContent()
  }, [candles])

  return <div ref={containerRef} className="market-candles-chart" />
}
