import { useState } from 'react'
import LandingPage from './components/LandingPage.jsx'
import SimulationPage from './components/SimulationPage.jsx'

export default function App() {
    const [view, setView] = useState('landing')
    const [config, setConfig] = useState(null)

    const handleStart = (cfg) => {
        setConfig(cfg)
        setView('simulation')
    }

    const handleBack = () => {
        setView('landing')
        setConfig(null)
    }

    return (
        <div className="app">
            {view === 'landing' && <LandingPage onStart={handleStart} />}
            {view === 'simulation' && <SimulationPage config={config} onBack={handleBack} />}
        </div>
    )
}
