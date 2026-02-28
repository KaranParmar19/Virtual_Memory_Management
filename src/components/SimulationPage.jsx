import { useState, useRef, useEffect, useCallback } from 'react'
import MemoryManager from '../core/memoryManager.js'
import MemoryGrid from './MemoryGrid.jsx'
import ProcessQueue from './ProcessQueue.jsx'
import MetricsPanel from './MetricsPanel.jsx'
import ActionBanner from './ActionBanner.jsx'
import SystemConsole from './SystemConsole.jsx'
import Charts from './Charts.jsx'

export default function SimulationPage({ config, onBack }) {
    const mmRef = useRef(null)
    const [frames, setFrames] = useState([])
    const [frameMetadata, setFrameMetadata] = useState([])
    const [totalFrames, setTotalFrames] = useState(config.frameCount || 16)
    const [processes, setProcesses] = useState([])
    const [metrics, setMetrics] = useState({})
    const [logs, setLogs] = useState([])
    const [history, setHistory] = useState([])
    const [actionEvent, setActionEvent] = useState(null)
    const [banner, setBanner] = useState({ type: 'info', message: 'Simulation ready. Add processes to begin.' })
    const [isThrashing, setIsThrashing] = useState(false)
    const processCounter = useRef(1)

    // Initialize MemoryManager
    useEffect(() => {
        const mm = new MemoryManager(config.pageSize, config.totalMemory)
        mmRef.current = mm
        setTotalFrames(mm.frameTable.length)

        // Subscribe to all events
        mm.addListener((eventType, data) => {
            if (eventType === 'systemLog') {
                setLogs(prev => {
                    const next = [...prev, { message: data.message, type: data.type }]
                    return next.length > 200 ? next.slice(-200) : next
                })
                return
            }

            if (eventType === 'stats') {
                const s = data
                setMetrics(s)
                setIsThrashing(!!s.isThrashing)
                setFrameMetadata(s.frameMetadata || [])
                setFrames([...mm.frameTable])

                setHistory(prev => {
                    const next = [...prev, { hitRatio: parseFloat(s.hitRatio) || 0, pageFaults: s.pageFaults || 0 }]
                    return next.length > 30 ? next.slice(-30) : next
                })

                // Update processes list
                const procs = []
                mm.processes.forEach((proc, id) => {
                    const framesUsed = mm.frameTable.filter(f => f === id).length
                    procs.push({ id, size: proc.size, framesUsed })
                })
                setProcesses(procs)
                return
            }

            if (eventType === 'pageHit') {
                setActionEvent({ type: 'hit', frameIndex: data.frameIndex })
                setBanner({ type: 'hit', message: `Process ${data.processId} → Page ${data.logicalPage} found in Frame ${data.frameIndex} (TLB/RAM hit)` })
            } else if (eventType === 'pageFault') {
                setActionEvent({ type: 'fault', frameIndex: data.frameIndex })
                setBanner({ type: 'fault', message: `Process ${data.processId} → Page ${data.logicalPage} NOT in memory. Loading from disk…` })
            } else if (eventType === 'pageEvict') {
                setActionEvent({ type: 'evict', frameIndex: data.frameIndex })
                setBanner({ type: 'swap', message: `Frame ${data.frameIndex} evicted to swap space (${config.algorithm?.toUpperCase()})` })
            }

            // Re-render after any memory change
            setFrames([...mm.frameTable])
        })

        return () => { mmRef.current = null }
    }, [])

    const addProcess = useCallback(() => {
        const mm = mmRef.current
        if (!mm) return
        const id = processCounter.current++
        const size = (Math.floor(Math.random() * 4) + 2) * config.pageSize * 1024 // 2-6 pages
        const ok = mm.allocateMemory(id, size)
        if (!ok) {
            setBanner({ type: 'fault', message: `Could not allocate memory for Process ${id} — memory full!` })
        } else {
            setBanner({ type: 'info', message: `Process ${id} allocated ${Math.ceil(size / (config.pageSize * 1024))} pages.` })
        }
        refreshStats()
    }, [config])

    const runCycle = useCallback(() => {
        const mm = mmRef.current
        if (!mm || mm.processes.size === 0) return
        const processIds = Array.from(mm.processes.keys())
        const randomPid = processIds[Math.floor(Math.random() * processIds.length)]
        const proc = mm.processes.get(randomPid)
        if (!proc) return
        const pageCount = Math.ceil(proc.size / mm.pageSize)
        const randomPage = Math.floor(Math.random() * pageCount)
        mm.getReplacementAlgorithm(randomPid, randomPage, config.algorithm || 'lru')
        refreshStats()
    }, [config])

    const removeProcess = useCallback(() => {
        const mm = mmRef.current
        if (!mm || mm.processes.size === 0) return
        const ids = Array.from(mm.processes.keys())
        const pid = ids[ids.length - 1]
        mm.deallocateMemory(pid)
        setBanner({ type: 'info', message: `Process ${pid} removed and frames freed.` })
        refreshStats()
    }, [])

    const reset = useCallback(() => {
        const mm = mmRef.current
        if (!mm) return
        mm.processes.clear()
        mm.frameTable.fill(null)
        mm.freeFrames = [...Array(mm.frameTable.length).keys()]
        mm.pageFaults = 0; mm.pageHits = 0; mm.tlbHits = 0; mm.tlbMisses = 0
        mm.tlb.clear(); mm.swapSpace.clear(); mm.systemLogs = []
        processCounter.current = 1
        setFrames([...mm.frameTable])
        setFrameMetadata([])
        setProcesses([])
        setMetrics({})
        setHistory([])
        setLogs([])
        setIsThrashing(false)
        setBanner({ type: 'info', message: 'Simulation reset.' })
    }, [])

    const refreshStats = () => {
        const mm = mmRef.current
        if (!mm) return
        const s = mm.getStats()
        mm.notifyListeners('stats', s)
    }

    return (
        <div className="sim-page">
            {/* Header */}
            <div className="sim-header">
                <div className="sim-header-left">
                    <button className="btn" onClick={onBack}><i className="fas fa-arrow-left" /> Back</button>
                    <h1>
                        <i className="fas fa-memory" /> MemoryViz
                        <span>OS Simulator</span>
                    </h1>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', background: 'var(--surface-alt)', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        <i className="fas fa-cog" /> {config.algorithm?.toUpperCase()} · Page {config.pageSize}KB
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="btn primary" onClick={addProcess}><i className="fas fa-plus" /> Add Process</button>
                    <button className="btn" onClick={runCycle}><i className="fas fa-forward" /> Run Cycle</button>
                    <button className="btn" onClick={removeProcess}><i className="fas fa-minus" /> Remove</button>
                    <button className="btn danger" onClick={reset}><i className="fas fa-redo" /> Reset</button>
                </div>
            </div>

            {/* Body */}
            <div className="sim-body">
                {/* Left: Process Queue + Metrics */}
                <div className="sim-left">
                    <ProcessQueue processes={processes} activeProcessId={processes[processes.length - 1]?.id} />
                    <MetricsPanel metrics={metrics} isThrashing={isThrashing} />
                </div>

                {/* Center: Action Banner + Memory Grid + Charts */}
                <div className="sim-center">
                    <ActionBanner type={banner.type} message={banner.message} />

                    <div className="panel">
                        <div className="panel-header">
                            <h3><i className="fas fa-server" /> Physical Memory — {totalFrames} Frames</h3>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                                {metrics.usedFrames ?? 0}/{totalFrames} used
                            </span>
                        </div>
                        <MemoryGrid
                            frames={frames}
                            frameMetadata={frameMetadata}
                            totalFrames={totalFrames}
                            actionEvent={actionEvent}
                        />
                    </div>

                    <Charts history={history} metrics={metrics} />
                </div>

                {/* Right: System Console */}
                <div className="sim-right">
                    <SystemConsole logs={logs} onClear={() => setLogs([])} />
                </div>
            </div>
        </div>
    )
}
