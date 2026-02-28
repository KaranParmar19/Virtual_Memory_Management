import { useRef, useEffect } from 'react'
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, PointElement, LineElement,
    BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
        tooltip: { mode: 'index', intersect: false }
    },
    scales: {
        x: { ticks: { color: '#64748b', maxTicksLimit: 6 }, grid: { color: 'rgba(30,45,69,0.8)' } },
        y: { beginAtZero: true, max: 100, ticks: { color: '#64748b' }, grid: { color: 'rgba(30,45,69,0.8)' }, title: { display: true, text: 'Hit Ratio (%)', color: '#64748b' } },
        y1: { position: 'right', beginAtZero: true, ticks: { color: '#64748b' }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Page Faults', color: '#64748b' } }
    }
}

const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: { legend: { display: false } },
    scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(30,45,69,0.8)' } },
        y: { beginAtZero: true, ticks: { color: '#64748b' }, grid: { color: 'rgba(30,45,69,0.8)' } }
    }
}

export default function Charts({ history, metrics }) {
    const lineData = {
        labels: history.map((_, i) => `T${i + 1}`),
        datasets: [
            {
                label: 'Hit Ratio (%)',
                data: history.map(h => h.hitRatio),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99,102,241,0.08)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                yAxisID: 'y'
            },
            {
                label: 'Page Faults',
                data: history.map(h => h.pageFaults),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239,68,68,0.08)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                yAxisID: 'y1'
            }
        ]
    }

    const barData = {
        labels: ['Int. Frag', 'Ext. Frag', 'Page Faults', 'Page Hits'],
        datasets: [{
            data: [
                metrics?.internalFragmentation ?? 0,
                metrics?.externalFragmentation ?? 0,
                metrics?.pageFaults ?? 0,
                metrics?.pageHits ?? 0
            ],
            backgroundColor: ['#f59e0b', '#06b6d4', '#ef4444', '#10b981'],
            borderRadius: 6,
        }]
    }

    return (
        <div className="charts-area">
            <div className="panel">
                <div className="panel-header">
                    <h3><i className="fas fa-chart-line" /> Performance Over Time</h3>
                </div>
                <div className="panel-body">
                    <div className="chart-wrapper">
                        <Line data={lineData} options={lineOptions} />
                    </div>
                </div>
            </div>
            <div className="panel">
                <div className="panel-header">
                    <h3><i className="fas fa-chart-bar" /> Memory Breakdown</h3>
                </div>
                <div className="panel-body">
                    <div className="chart-wrapper">
                        <Bar data={barData} options={barOptions} />
                    </div>
                </div>
            </div>
        </div>
    )
}
