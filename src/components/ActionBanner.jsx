import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

const TYPE_CONFIG = {
    hit: { icon: 'fa-check-circle', label: 'Page Hit' },
    fault: { icon: 'fa-exclamation-triangle', label: 'Page Fault' },
    swap: { icon: 'fa-sync', label: 'Swap / Eviction' },
    info: { icon: 'fa-info-circle', label: 'Info' },
}

export default function ActionBanner({ type = 'info', message = 'Waiting for simulation to begin…' }) {
    const bannerRef = useRef(null)
    const prevType = useRef(type)

    useEffect(() => {
        if (!bannerRef.current || type === prevType.current) return
        gsap.fromTo(bannerRef.current,
            { opacity: 0, y: -8 },
            { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
        )
        prevType.current = type
    }, [type, message])

    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info

    return (
        <div ref={bannerRef} className={`action-banner ${type}`}>
            <i className={`fas ${cfg.icon}`} />
            <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.7 }}>
                    {cfg.label}
                </div>
                <div>{message}</div>
            </div>
        </div>
    )
}
