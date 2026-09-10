import { useEffect, useRef, useState } from 'react'

// Characters ordered dark → light (suits dark background)
const ASCII_RAMP = ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'

const FONT_SIZE = 7
const LINE_HEIGHT = 7

interface AnsiCell {
  fg: string
  bg: string
}

interface Props {
  src: string
  mode?: 'ansi' | 'ascii'
  // Max bounding box in characters — actual size is calculated from image aspect ratio
  maxWidth?: number
  maxHeight?: number
  // Force a specific output aspect ratio (w/h) with center-cropping
  forceAspect?: number
  // CSS brightness multiplier (1 = normal, 1.5 = brighter)
  brightness?: number
  className?: string
}

export function AnsiArt({ src, mode = 'ansi', maxWidth = 36, maxHeight = 28, forceAspect, brightness = 1, className = '' }: Props) {
  const [ansiRows, setAnsiRows] = useState<AnsiCell[][]>([])
  const [asciiRows, setAsciiRows] = useState<{ char: string; color: string }[][]>([])
  const [loading, setLoading] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    setLoading(true)
    setAnsiRows([])
    setAsciiRows([])

    const img = new Image()
    // Load via same-origin proxy to avoid all CORS/cache issues
    const proxiedSrc = `/api/cover?proxy=${encodeURIComponent(src)}`

    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!

      // Measure the actual character width in this browser/font so the aspect ratio is exact
      ctx.font = `${FONT_SIZE}px monospace`
      const charW = ctx.measureText('0').width
      const charAspect = charW / LINE_HEIGHT  // charW / charH

      // Center-crop source if forceAspect is set
      const targetAspect = forceAspect ?? (img.naturalWidth / img.naturalHeight)
      const naturalAspect = img.naturalWidth / img.naturalHeight
      let srcX = 0, srcY = 0
      let srcW = img.naturalWidth, srcH = img.naturalHeight
      if (forceAspect) {
        if (naturalAspect > forceAspect) {
          srcW = Math.round(img.naturalHeight * forceAspect)
          srcX = Math.round((img.naturalWidth - srcW) / 2)
        } else {
          srcH = Math.round(img.naturalWidth / forceAspect)
          srcY = Math.round((img.naturalHeight - srcH) / 2)
        }
      }

      let w = maxWidth
      let h = Math.round(w * charAspect / targetAspect)
      if (h > maxHeight) {
        h = maxHeight
        w = Math.round(h * targetAspect / charAspect)
      }
      w = Math.max(1, w)
      h = Math.max(1, h)

      if (mode === 'ansi') {
        canvas.width = w
        canvas.height = h * 2
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, w, h * 2)

        let imageData: ImageData
        try {
          imageData = ctx.getImageData(0, 0, w, h * 2)
        } catch {
          setLoading(false)
          return
        }
        const { data } = imageData

        const result: AnsiCell[][] = []
        for (let row = 0; row < h; row++) {
          const cols: AnsiCell[] = []
          for (let col = 0; col < w; col++) {
            const ti = ((row * 2) * w + col) * 4
            const bi = ((row * 2 + 1) * w + col) * 4
            cols.push({
              fg: `rgb(${data[ti]},${data[ti + 1]},${data[ti + 2]})`,
              bg: `rgb(${data[bi]},${data[bi + 1]},${data[bi + 2]})`,
            })
          }
          result.push(cols)
        }
        setAnsiRows(result)

      } else {
        canvas.width = w
        canvas.height = h
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, w, h)

        let imageData: ImageData
        try {
          imageData = ctx.getImageData(0, 0, w, h)
        } catch {
          setLoading(false)
          return
        }
        const { data } = imageData

        const rows: { char: string; color: string }[][] = []
        for (let row = 0; row < h; row++) {
          const cols: { char: string; color: string }[] = []
          for (let col = 0; col < w; col++) {
            const i = (row * w + col) * 4
            const r = data[i], g = data[i + 1], b = data[i + 2]
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b
            const charIdx = Math.floor(brightness / 255 * (ASCII_RAMP.length - 1))
            cols.push({ char: ASCII_RAMP[charIdx], color: `rgb(${r},${g},${b})` })
          }
          rows.push(cols)
        }
        setAsciiRows(rows)
      }

      setLoading(false)
    }

    img.onerror = () => setLoading(false)
    img.src = proxiedSrc
  }, [src, mode, maxWidth, maxHeight, forceAspect])

  const isEmpty = mode === 'ansi' ? ansiRows.length === 0 : asciiRows.length === 0

  return (
    <div className={className}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {loading ? (
        <div
          style={{ width: maxWidth * 5, height: maxHeight * 7 }}
          className="flex items-center justify-center text-dim text-xs"
        >
          loading...
        </div>
      ) : isEmpty ? null : mode === 'ansi' ? (
        <div
          style={{
            filter: brightness !== 1 ? `brightness(${brightness})` : undefined,
            fontFamily: 'monospace',
            fontSize: '7px',
            lineHeight: '7px',
            letterSpacing: 0,
            userSelect: 'none',
            display: 'inline-block',
          }}
        >
          {ansiRows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex' }}>
              {row.map((cell, ci) => (
                <span
                  key={ci}
                  style={{
                    color: cell.fg,
                    backgroundColor: cell.bg,
                    display: 'inline-block',
                    width: '1ch',
                    lineHeight: '7px',
                    flexShrink: 0,
                  }}
                >
                  ▄
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            filter: brightness !== 1 ? `brightness(${brightness})` : undefined,
            fontFamily: 'monospace',
            fontSize: '7px',
            lineHeight: '8px',
            letterSpacing: '0.5px',
            userSelect: 'none',
            display: 'inline-block',
          }}
        >
          {asciiRows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex' }}>
              {row.map((cell, ci) => (
                <span key={ci} style={{ color: cell.color, flexShrink: 0 }}>
                  {cell.char}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
