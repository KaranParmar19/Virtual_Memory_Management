import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

const ALGORITHMS = [
    { value: 'fifo', label: 'FIFO — First In First Out' },
    { value: 'lru', label: 'LRU — Least Recently Used' },
    { value: 'optimal', label: 'Optimal — Belady\'s Algorithm' },
    { value: 'clock', label: 'Clock — Second Chance' },
    { value: 'hybrid', label: 'Hybrid — LRU + LFU' },
    { value: 'adaptive', label: 'Adaptive — ML Weights' },
]

export default function LandingPage({ onStart }) {
    const container = useRef(null)
    const config = useRef({ algorithm: 'lru', pageSize: 4, totalMemory: 64, processCount: 3, frameCount: 16 })

    useGSAP(() => {
        gsap.from('.landing-hero', { opacity: 0, y: -40, duration: 0.8, ease: 'power3.out' })
        gsap.from('.config-card', { opacity: 0, y: 40, duration: 0.8, delay: 0.2, ease: 'power3.out' })
        gsap.from('.badge', { opacity: 0, scale: 0.7, duration: 0.5, delay: 0.1, ease: 'back.out(2)' })
    }, { scope: container })

    const update = (key, val) => { config.current[key] = val }

    const handleStart = () => {
        gsap.to(container.current, {
            opacity: 0, y: -30, duration: 0.4, ease: 'power2.in',
            onComplete: () => onStart({ ...config.current })
        })
    }

    return (
        <div className="landing" ref={container}>
            <div className="landing-hero">
                <div className="badge"><i className="fas fa-microchip" /> Expert OS Simulator</div>
                <h1>Virtual Memory<br />Management</h1>
                <p>Visualize TLB lookups, page faults, replacement algorithms, and thrashing — in real time.</p>
            </div>

            <div className="config-card">
                <h2><i className="fas fa-sliders-h" style={{ marginRight: '8px' }} />Configure Simulation</h2>

                <div className="form-grid">
                    <div className="form-group">
                        <label>Replacement Algorithm</label>
                        <select defaultValue="lru" onChange={e => update('algorithm', e.target.value)}>
                            {ALGORITHMS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Page Size</label>
                        <select defaultValue="4" onChange={e => update('pageSize', Number(e.target.value))}>
                            <option value="2">2 KB</option>
                            <option value="4">4 KB (Default)</option>
                            <option value="8">8 KB</option>
                            <option value="16">16 KB</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Total Memory — <span id="memLabel">64 MB</span></label>
                        <div className="range-row">
                            <input type="range" min="32" max="256" step="32" defaultValue="64"
                                onChange={e => { update('totalMemory', Number(e.target.value)); document.getElementById('memLabel').textContent = e.target.value + ' MB' }} />
                            <span>64 MB</span>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Frame Count — <span id="frameLabel">16</span></label>
                        <div className="range-row">
                            <input type="range" min="8" max="64" step="8" defaultValue="16"
                                onChange={e => { update('frameCount', Number(e.target.value)); document.getElementById('frameLabel').textContent = e.target.value }} />
                            <span>16</span>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Process Count — <span id="procLabel">3</span></label>
                        <div className="range-row">
                            <input type="range" min="1" max="8" defaultValue="3"
                                onChange={e => { update('processCount', Number(e.target.value)); document.getElementById('procLabel').textContent = e.target.value }} />
                            <span>3</span>
                        </div>
                    </div>
                </div>

                <button className="btn-start" onClick={handleStart}>
                    <i className="fas fa-play" /> Launch Simulation
                </button>
            </div>
        </div>
    )
}
