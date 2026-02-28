export default function MetricsPanel({ metrics, isThrashing }) {
    const stats = [
        { label: 'Hit Ratio', value: `${metrics?.hitRatio ?? 0}%`, sub: 'Page hits / total accesses', warn: metrics?.hitRatio < 50 },
        { label: 'TLB Hit Ratio', value: `${metrics?.tlbHitRatio ?? 0}%`, sub: 'Hardware cache efficiency' },
        { label: 'Page Faults', value: metrics?.pageFaults ?? 0, sub: 'Disk loads required' },
        { label: 'Fragmentation', value: `${metrics?.fragmentation ?? 0}%`, sub: 'Wasted memory space' },
        { label: 'Throughput', value: `${metrics?.throughput ?? 0}`, sub: 'Operations / second' },
        { label: 'Frames Used', value: `${metrics?.usedFrames ?? 0}/${metrics?.totalFrames ?? 0}`, sub: 'Physical memory usage' },
    ]

    return (
        <div className="panel">
            <div className="panel-header">
                <h3><i className="fas fa-chart-bar" /> Performance Metrics</h3>
                {isThrashing && (
                    <span style={{ fontSize: '0.75rem', color: '#fca5a5', fontWeight: 700 }}>
                        <i className="fas fa-exclamation-triangle" /> THRASHING
                    </span>
                )}
            </div>
            <div className="panel-body">
                {isThrashing && (
                    <div className="thrashing-banner" style={{ marginBottom: '0.75rem' }}>
                        <i className="fas fa-fire-alt" />
                        Thrashing Detected! CPU is spending more time paging than executing.
                    </div>
                )}
                <div className="metrics-grid">
                    {stats.map(s => (
                        <div key={s.label} className={`metric-card ${isThrashing && s.label === 'Hit Ratio' ? 'thrashing' : ''}`}>
                            <div className="m-label">{s.label}</div>
                            <div className="m-value">{s.value}</div>
                            <div className="m-sub">{s.sub}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
