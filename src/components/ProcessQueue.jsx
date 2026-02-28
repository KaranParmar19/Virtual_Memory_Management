const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

export default function ProcessQueue({ processes, activeProcessId }) {
    return (
        <div className="panel">
            <div className="panel-header">
                <h3><i className="fas fa-layer-group" /> Process Queue</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{processes.length} active</span>
            </div>
            <div className="panel-body">
                {processes.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
                        No processes yet
                    </div>
                ) : (
                    <div className="process-list">
                        {processes.map((proc, i) => (
                            <div key={proc.id} className={`process-item ${proc.id === activeProcessId ? 'active' : ''}`}>
                                <div className="proc-color" style={{ backgroundColor: COLORS[(proc.id - 1) % COLORS.length] }} />
                                <div className="proc-info">
                                    <div className="proc-name">Process {proc.id}</div>
                                    <div className="proc-detail">
                                        {proc.framesUsed} frames · {(proc.size / 1024).toFixed(0)} KB
                                    </div>
                                </div>
                                {proc.id === activeProcessId && (
                                    <span className="proc-badge"><i className="fas fa-circle-dot" /> Running</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
