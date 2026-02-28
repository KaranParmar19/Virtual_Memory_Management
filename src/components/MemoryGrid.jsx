import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

const PROCESS_COLORS = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'
]

export default function MemoryGrid({ frames, frameMetadata, totalFrames, actionEvent }) {
    const gridRef = useRef(null)
    const prevFrames = useRef([])
    const tooltip = useRef(null)

    // Animate newly mounted grid
    useGSAP(() => {
        gsap.from('.frame', {
            scale: 0, opacity: 0, duration: 0.4,
            stagger: { amount: 0.8, from: 'start', grid: 'auto' },
            ease: 'back.out(1.4)'
        })
    }, { scope: gridRef, dependencies: [totalFrames] })

    // Animate specific frame events
    useEffect(() => {
        if (!actionEvent || !gridRef.current) return
        const { type, frameIndex } = actionEvent
        const block = gridRef.current.querySelector(`[data-frame="${frameIndex}"]`)
        if (!block) return

        block.classList.remove('action-hit', 'action-fault', 'action-evict')
        void block.offsetWidth // force reflow
        if (type === 'hit') block.classList.add('action-hit')
        else if (type === 'fault') block.classList.add('action-fault')
        else if (type === 'evict') block.classList.add('action-evict')

        setTimeout(() => block.classList.remove('action-hit', 'action-fault', 'action-evict'), 800)
    }, [actionEvent])

    const showTooltip = (e, i, meta) => {
        const tt = tooltip.current
        if (!tt) return
        const head = tt.querySelector('.tt-head')
        head.textContent = `Physical Frame ${i}`

        if (meta?.status === 'Free' || !frames[i]) {
            tt.querySelector('#tt-status').textContent = 'Free'
            tt.querySelector('#tt-status').className = 'tt-val tt-free'
            tt.querySelector('#tt-proc').textContent = '—'
            tt.querySelector('#tt-page').textContent = '—'
            tt.querySelector('#tt-bits').textContent = '—'
        } else {
            tt.querySelector('#tt-status').textContent = 'Allocated'
            tt.querySelector('#tt-status').className = 'tt-val tt-hit'
            tt.querySelector('#tt-proc').textContent = `Process ${meta.processId}`
            tt.querySelector('#tt-page').textContent = meta.logicalPage !== undefined ? `Page ${meta.logicalPage}` : '—'
            const bits = [
                `V=${meta.valid ? 1 : 0}`,
                `D=${meta.dirty ? 1 : 0}`,
                `R=${meta.reference ? 1 : 0}`
            ].join('  ')
            tt.querySelector('#tt-bits').textContent = bits
        }

        tt.style.display = 'block'
        moveTooltip(e)
    }

    const moveTooltip = (e) => {
        const tt = tooltip.current
        if (!tt || tt.style.display === 'none') return
        let x = e.clientX + 14, y = e.clientY - 14
        const rect = tt.getBoundingClientRect()
        if (x + rect.width > window.innerWidth) x = e.clientX - rect.width - 14
        if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - 14
        tt.style.left = x + 'px'
        tt.style.top = y + 'px'
    }

    const hideTooltip = () => {
        if (tooltip.current) tooltip.current.style.display = 'none'
    }

    return (
        <div className="memory-grid-wrapper">
            <div className="memory-grid" ref={gridRef}>
                {Array.from({ length: totalFrames }, (_, i) => {
                    const pid = frames[i]
                    const color = pid !== null && pid !== undefined
                        ? PROCESS_COLORS[(pid - 1) % PROCESS_COLORS.length]
                        : null
                    const meta = frameMetadata?.[i]

                    return (
                        <div
                            key={i}
                            data-frame={i}
                            className={`frame ${pid ? 'used' : 'free'}`}
                            style={color ? { backgroundColor: color } : {}}
                            onMouseEnter={e => showTooltip(e, i, meta)}
                            onMouseLeave={hideTooltip}
                            onMouseMove={moveTooltip}
                            title=""
                        />
                    )
                })}
            </div>

            {/* Tooltip */}
            <div
                ref={tooltip}
                className="frame-tooltip"
                style={{ display: 'none', position: 'fixed' }}
            >
                <div className="tt-head">Frame 0</div>
                <div className="tt-body">
                    <div className="tt-row"><span className="tt-label">Status</span><span id="tt-status" className="tt-val">Free</span></div>
                    <div className="tt-row"><span className="tt-label">Process</span><span id="tt-proc" className="tt-val">—</span></div>
                    <div className="tt-row"><span className="tt-label">Logical Page</span><span id="tt-page" className="tt-val">—</span></div>
                    <div className="tt-row"><span className="tt-label">HW Bits</span><span id="tt-bits" className="tt-val" style={{ fontFamily: 'JetBrains Mono', fontSize: '0.72rem', letterSpacing: '0.04em' }}>—</span></div>
                </div>
            </div>

            {/* Legend */}
            <div className="legend">
                <div className="legend-item"><div className="legend-dot free" /><span>Free Frame</span></div>
                <div className="legend-item"><div className="legend-dot" style={{ background: PROCESS_COLORS[0] }} /><span>Allocated</span></div>
                <div className="legend-item"><div className="legend-dot hit" /><span>Page Hit (green flash)</span></div>
                <div className="legend-item"><div className="legend-dot fault" /><span>Page Fault (red flash)</span></div>
                <div className="legend-item"><div className="legend-dot evict" /><span>Evicted to Swap (blue fade)</span></div>
            </div>
        </div>
    )
}
