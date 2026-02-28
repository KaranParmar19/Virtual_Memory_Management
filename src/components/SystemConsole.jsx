import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'

const LINE_TYPES = {
    info: 'log-info',
    success: 'log-success',
    warning: 'log-warning',
    error: 'log-error',
    lookup: 'log-lookup',
    process: 'log-process',
}

export default function SystemConsole({ logs, onClear }) {
    const bodyRef = useRef(null)

    // Auto-scroll + animate new lines
    useEffect(() => {
        const el = bodyRef.current
        if (!el) return
        const lastLine = el.lastChild
        if (lastLine) {
            gsap.fromTo(lastLine, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.25, ease: 'power2.out' })
        }
        el.scrollTop = el.scrollHeight
    }, [logs])

    return (
        <div className="panel" style={{ flex: 1 }}>
            <div className="panel-header">
                <h3>
                    <i className="fas fa-terminal" />
                    Kernel Console
                </h3>
                <button className="btn sm" onClick={onClear} title="Clear console">
                    <i className="fas fa-trash-alt" />
                </button>
            </div>
            <div className="console-body" ref={bodyRef}>
                {logs.length === 0 ? (
                    <span className="log-info">{'>'} Waiting for kernel operations…</span>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className={`log-line ${LINE_TYPES[log.type] ?? 'log-info'}`}>
                            {log.message}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
