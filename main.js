document.addEventListener('DOMContentLoaded', () => {
    let memoryManager;
    let visualization;
    let isSimulationRunning = false;
    let simulationInterval;
    
    // Initialize UI elements
    const startButton = document.getElementById('startSimulation');
    const pauseButton = document.getElementById('pauseSimulation');
    const resetButton = document.getElementById('resetSimulation');
    const toggleViewButton = document.getElementById('toggleView');
    const toggleAnimationButton = document.getElementById('toggleAnimation');
    const backButton = document.getElementById('backToLanding');
    
    // Setup range input listeners
    setupRangeInputs();
    
    // Setup button listeners
    startButton.addEventListener('click', startSimulation);
    pauseButton.addEventListener('click', togglePause);
    resetButton.addEventListener('click', resetSimulation);
    toggleViewButton.addEventListener('click', toggleView);
    toggleAnimationButton.addEventListener('click', toggleAnimation);
    backButton.addEventListener('click', goToLandingPage);

    // Setup theme toggle if it exists
    setupThemeToggle();

    // Disable pause button initially
    pauseButton.disabled = true;
    resetButton.disabled = true;

    // Remove page transition on load
    setTimeout(() => {
        const pageTransition = document.querySelector('.page-transition');
        if (pageTransition) {
            pageTransition.classList.remove('active');
            pageTransition.style.display = 'none';
        }
    }, 1000);

    function setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        if (!themeToggle) return;

        const body = document.body;
        const icon = themeToggle.querySelector('i');

        themeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            icon.classList.toggle('fa-moon');
            icon.classList.toggle('fa-sun');
            
            // Save theme preference
            const isDark = body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });

        // Load saved theme
        if (localStorage.getItem('theme') === 'dark') {
            body.classList.add('dark-mode');
            if (icon) {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            }
        }
    }
    

    function setupRangeInputs() {
        // Page Size
        const pageSizeInput = document.getElementById('pageSize');
        const pageSizeValue = document.getElementById('pageSizeValue');
        if (pageSizeInput && pageSizeValue) {
            pageSizeValue.textContent = `${pageSizeInput.value} KB`;
            
            pageSizeInput.addEventListener('input', () => {
                pageSizeValue.textContent = `${pageSizeInput.value} KB`;
            });
        }
        
        // Total Memory
        const totalMemoryInput = document.getElementById('totalMemory');
        const totalMemoryValue = document.getElementById('totalMemoryValue');
        if (totalMemoryInput && totalMemoryValue) {
            totalMemoryValue.textContent = `${totalMemoryInput.value} MB`;
            
            totalMemoryInput.addEventListener('input', () => {
                totalMemoryValue.textContent = `${totalMemoryInput.value} MB`;
            });
        }
        
        // Process Count
        const processCountInput = document.getElementById('processCount');
        const processCountValue = document.getElementById('processCountValue');
        if (processCountInput && processCountValue) {
            processCountValue.textContent = processCountInput.value;
            
            processCountInput.addEventListener('input', () => {
                processCountValue.textContent = processCountInput.value;
            });
        }
        
        // Memory Threshold
        const memoryThresholdInput = document.getElementById('memoryThreshold');
        const memoryThresholdValue = document.getElementById('memoryThresholdValue');
        if (memoryThresholdInput && memoryThresholdValue) {
            memoryThresholdValue.textContent = `${memoryThresholdInput.value}%`;
            
            memoryThresholdInput.addEventListener('input', () => {
                memoryThresholdValue.textContent = `${memoryThresholdInput.value}%`;
            });
        }
    }

    function startSimulation() {
        // Validate inputs first
        const pageSize = parseInt(document.getElementById('pageSize').value);
        const totalMemory = parseInt(document.getElementById('totalMemory').value);
        
        if (isNaN(pageSize) || pageSize <= 0 || isNaN(totalMemory) || totalMemory <= 0) {
            alert('Please enter valid positive numbers for memory settings');
            return;
        }

        // Initialize simulation
        if (!initializeSimulation()) {
            alert('Failed to initialize simulation');
            return;
        }

        // Setup event listeners for updates
        memoryManager.addListener((eventType, data) => {
            if (eventType === 'allocation' || eventType === 'deallocation') {
                visualization.updateMemoryMap();
            } else if (eventType === 'stats') {
                visualization.updateStats(data);
            } else if (eventType === 'processQueue') {
                updateProcessQueueUI(data.processes);
            }
        });

        // Update UI state
        document.getElementById('startSimulation').disabled = true;
        document.getElementById('pauseSimulation').disabled = false;
        document.getElementById('resetSimulation').disabled = false;
        isSimulationRunning = true;
        
        // Start simulation loop
        simulationInterval = setInterval(() => {
            if (isSimulationRunning) {
                runSimulationStep();
            }
        }, 1000);
        
        // Initialize metrics panel
        updateMetricsPanel();
    }

    function initializeSimulation() {
        try {
            // Get input values
            const pageSize = parseInt(document.getElementById('pageSize').value);
            const totalMemory = parseInt(document.getElementById('totalMemory').value);
            const processCount = parseInt(document.getElementById('processCount').value);
            
            // Create memory manager
            memoryManager = new MemoryManager(pageSize, totalMemory);
            
            // Create visualization
            visualization = new MemoryVisualization(memoryManager);
            
            // Generate some initial processes
            const processes = [];
            for (let i = 1; i <= processCount; i++) {
                const process = createProcess(i);
                processes.push(process);
                
                // Add to memory manager
                memoryManager.addProcess(process.id, process.size, process.duration);
                
                // Randomly allocate some processes
                if (Math.random() > 0.5) {
                    process.isAllocated = true;
                    
                    // Allocate some random frames
                    const frameCount = Math.floor(Math.random() * 5) + 1;
                    for (let j = 0; j < frameCount; j++) {
                        const frameId = Math.floor(Math.random() * (totalMemory / pageSize));
                        memoryManager.allocateFrame(process.id, frameId);
                    }
                }
            }
            
            // Initial visualization update
            visualization.updateMemoryMap();
            
            console.log("Simulation initialized with processes:", processes);
            return true;
        } catch (error) {
            console.error("Error initializing simulation:", error);
            return false;
        }
    }

    function togglePause() {
        isSimulationRunning = !isSimulationRunning;
        document.getElementById('pauseSimulation').textContent = 
            isSimulationRunning ? 'Pause' : 'Resume';
    }

    function resetSimulation() {
        // Clean up resources
        clearInterval(simulationInterval);
        simulationInterval = null;
        
        // Reset UI state
        document.getElementById('startSimulation').disabled = false;
        document.getElementById('pauseSimulation').disabled = true;
        document.getElementById('resetSimulation').disabled = true;
        document.getElementById('pauseSimulation').textContent = 'Pause';
        
        // Reset visualization
        if (visualization) visualization.resetCharts();
        
        isSimulationRunning = false;
    }

    function runSimulationStep() {
        try {
            // Get input values
            const processCount = parseInt(document.getElementById('processCount').value);
            const algorithm = document.getElementById('algorithm').value;
            const memoryThreshold = parseInt(document.getElementById('memoryThreshold').value);

            // Validate inputs
            if (isNaN(processCount)) throw new Error("Invalid process count");
            if (processCount <= 0) throw new Error("Process count must be greater than 0");

            // Run simulation step
            const processes = [];
            for (let i = 1; i <= processCount; i++) {
                const process = createProcess(i);
                processes.push(process);
                
                // Update process allocation status
                process.isAllocated = memoryManager.processes.has(process.id) ? memoryManager.processes.get(process.id).isAllocated : false;
                process.isCompleted = process.isAllocated ? (Math.random() > 0.7) : false;
                
                // Add process to memory manager if not already there
                if (!memoryManager.processes.has(process.id)) {
                    memoryManager.addProcess(process.id, process.size, process.duration);
                }
            }
            
            // Select a random process to execute
            const allocatedProcesses = processes.filter(p => p.isAllocated);
            if (allocatedProcesses.length > 0) {
                const randomIndex = Math.floor(Math.random() * allocatedProcesses.length);
                const executingProcess = allocatedProcesses[randomIndex];
                memoryManager.setCurrentExecutingProcess(executingProcess.id);
                console.log(`Currently executing process: P${executingProcess.id}`);
            } else {
                memoryManager.setCurrentExecutingProcess(null);
            }
            
            // Update process queue visualization
            memoryManager.notifyListeners('processQueue', { processes });
            
            const pageAccesses = processes.map(p => {
                const pagesInProcess = Math.ceil(p.size / memoryManager.pageSize);
                return Math.floor(Math.random() * pagesInProcess);
            });

            // Run page replacement algorithm
            const result = memoryManager.getReplacementAlgorithm(algorithm, pageAccesses);
            
            // Update memory manager state
            memoryManager.frameTable = result.frames;
            memoryManager.pageFaults += result.pageFaults.filter(Boolean).length;
            memoryManager.pageHits += result.pageFaults.filter(f => !f).length;

            // Update visualizations
            visualization.updateMemoryMap();
            updateMetricsPanel(); // Update metrics panel with real-time data
            
            // Check if memory utilization threshold has been reached
            const metrics = memoryManager.getStats();
            const memoryUsage = (metrics.usedFrames / metrics.totalFrames) * 100;
            
            if (memoryUsage >= memoryThreshold) {
                // Stop simulation when threshold is reached
                showNotification(`Memory utilization threshold (${memoryThreshold}%) reached! Simulation paused.`);
                togglePause();
                
                // Highlight the metrics panel to draw attention
                const metricsPanel = document.querySelector('.metrics');
                if (metricsPanel) {
                    metricsPanel.classList.add('threshold-reached');
                    setTimeout(() => {
                        metricsPanel.classList.remove('threshold-reached');
                    }, 3000);
                }
            }
            
            // Process lifecycle management
            const currentTime = Date.now();
            processes.forEach((process, i) => {
                if (process.isAllocated && currentTime >= process.duration) {
                    memoryManager.deallocateMemory(process.id);
                    processes[i] = createProcess(process.id);
                    processes[i].isAllocated = false;
                } else if (!process.isAllocated) {
                    // Try to allocate memory for new processes
                    const allocated = memoryManager.allocateMemory(process.id, process.size);
                    if (allocated) {
                        processes[i].isAllocated = true;
                    }
                }
            });

            updateProcessQueueUI(processes);
        } catch (error) {
            console.error('Simulation error:', error);
            resetSimulation();
        }
    }

    function updateMetricsPanel() {
        if (!memoryManager) return;
        
        // Get latest metrics
        const metrics = memoryManager.getStats();
        
        // Update page faults
        const pageFaultsElement = document.getElementById('pageFaults');
        if (pageFaultsElement) {
            pageFaultsElement.querySelector('span').textContent = `Page Faults: ${metrics.misses}`;
            pageFaultsElement.setAttribute('data-tooltip', `Total page faults: ${metrics.misses}\nOccurs when a requested page is not in memory`);
        }
        
        // Update hit ratio
        const hitRatioElement = document.getElementById('hitRatio');
        if (hitRatioElement) {
            hitRatioElement.querySelector('span').textContent = `Hit Ratio: ${metrics.hitRatio}%`;
            hitRatioElement.setAttribute('data-tooltip', `Hit Ratio: ${metrics.hitRatio}%\nPercentage of memory accesses that found the page in memory\nHigher is better`);
            
            // Add visual indicator for hit ratio
            const ratio = parseFloat(metrics.hitRatio);
            let color = '#f56565'; // Red for low hit ratio
            
            if (ratio >= 80) {
                color = '#48bb78'; // Green for high hit ratio
            } else if (ratio >= 50) {
                color = '#ecc94b'; // Yellow for medium hit ratio
            }
            
            hitRatioElement.style.borderLeft = `4px solid ${color}`;
        }
        
        // Update fragmentation
        const fragmentationElement = document.getElementById('fragmentation');
        if (fragmentationElement) {
            fragmentationElement.querySelector('span').textContent = `Fragmentation: ${metrics.fragmentation}%`;
            fragmentationElement.setAttribute('data-tooltip', `Fragmentation: ${metrics.fragmentation}%\nMeasures how scattered free memory is\nLower is better`);
            
            // Add visual indicator for fragmentation
            const frag = parseFloat(metrics.fragmentation);
            let color = '#48bb78'; // Green for low fragmentation
            
            if (frag >= 50) {
                color = '#f56565'; // Red for high fragmentation
            } else if (frag >= 20) {
                color = '#ecc94b'; // Yellow for medium fragmentation
            }
            
            fragmentationElement.style.borderLeft = `4px solid ${color}`;
        }
        
        // Update throughput
        const throughputElement = document.getElementById('throughput');
        if (throughputElement) {
            throughputElement.querySelector('span').textContent = `Throughput: ${metrics.throughput} ops/s`;
            throughputElement.setAttribute('data-tooltip', `Throughput: ${metrics.throughput} operations per second\nMeasures how many memory operations are processed per second\nHigher is better`);
        }
        
        // Update memory usage bar
        const metricsPanel = document.querySelector('.metrics');
        if (metricsPanel) {
            // Remove existing memory usage bar if any
            const existingBar = metricsPanel.querySelector('.memory-usage-bar');
            if (existingBar) {
                existingBar.remove();
            }
            
            // Add new memory usage bar
            const memoryUsage = (metrics.usedFrames / metrics.totalFrames) * 100;
            const memoryElement = document.createElement('div');
            memoryElement.className = 'memory-usage-bar';
            memoryElement.style.width = `${memoryUsage}%`;
            metricsPanel.appendChild(memoryElement);
            
            // Add memory usage tooltip to the metrics panel title
            const metricsTitle = metricsPanel.querySelector('h3');
            if (metricsTitle) {
                metricsTitle.setAttribute('data-tooltip', `Memory Usage: ${memoryUsage.toFixed(1)}%\nUsed Frames: ${metrics.usedFrames}/${metrics.totalFrames}`);
            }
        }
        
        // Update animation based on metrics
        if (metrics.hitRatio > 70) {
            document.querySelector('.metrics').classList.add('good-performance');
            document.querySelector('.metrics').classList.remove('poor-performance');
        } else if (metrics.hitRatio < 30) {
            document.querySelector('.metrics').classList.add('poor-performance');
            document.querySelector('.metrics').classList.remove('good-performance');
        } else {
            document.querySelector('.metrics').classList.remove('good-performance');
            document.querySelector('.metrics').classList.remove('poor-performance');
        }
    }

    function updateProcessQueueUI(processes) {
        const queueElement = document.getElementById('processQueue');
        if (!queueElement) return;
        
        queueElement.innerHTML = '';
        
        // Create a header for the active process panel
        const headerElement = document.createElement('div');
        headerElement.className = 'process-header';
        headerElement.innerHTML = `
            <div class="process-id">ID</div>
            <div class="process-size">Size</div>
            <div class="process-status">Status</div>
            <div class="process-frames">Frames</div>
        `;
        queueElement.appendChild(headerElement);
        
        // Get current executing process
        const currentExecutingProcess = memoryManager.getCurrentExecutingProcess();
        
        processes.forEach(process => {
            const processElement = document.createElement('div');
            const isExecuting = process.id === currentExecutingProcess;
            
            // Set class based on process status
            processElement.className = `process-item ${isExecuting ? 'executing' : ''} ${process.isAllocated ? 'allocated' : ''}`;
            
            // Get process frames if allocated
            let allocatedFrames = [];
            if (memoryManager.processes.has(process.id)) {
                const processObj = memoryManager.processes.get(process.id);
                if (processObj.frames) {
                    allocatedFrames = Array.from(processObj.frames);
                }
            }
            
            // Create detailed process information
            processElement.innerHTML = `
                <div class="process-id">P${process.id}</div>
                <div class="process-size">${(process.size / 1024).toFixed(0)} KB</div>
                <div class="process-status">
                    ${isExecuting ? '<span class="status-executing">Executing</span>' : 
                      process.isAllocated ? '<span class="status-allocated">Allocated</span>' : 
                      '<span class="status-waiting">Waiting</span>'}
                </div>
                <div class="process-frames">${allocatedFrames.length > 0 ? allocatedFrames.join(', ') : '-'}</div>
            `;
            
            // Add tooltip with more details
            processElement.title = `Process ID: ${process.id}
Size: ${process.size} bytes
Duration: ${(process.duration/1000).toFixed(2)}s
Status: ${isExecuting ? 'Currently Executing' : process.isAllocated ? 'Allocated' : 'Waiting'}
Frames: ${allocatedFrames.length > 0 ? allocatedFrames.join(', ') : 'None'}`;
            
            queueElement.appendChild(processElement);
        });
    }

    function createProcess(id) {
        return {
            id: id,
            size: Math.floor(Math.random() * 1024 * 4) + 1024, // 1MB to 5MB
            duration: Math.floor(Math.random() * 20000) + 5000, // 5-25 seconds
            isAllocated: false,
            isCompleted: false
        };
    }

    function toggleView() {
        if (!visualization) return;
        visualization.currentView = visualization.currentView === 'grid' ? 'list' : 'grid';
        visualization.updateMemoryMap();
    }

    function toggleAnimation() {
        if (!visualization) return;
        visualization.showAnimation = !visualization.showAnimation;
        toggleAnimationButton.innerHTML = visualization.showAnimation ? 
            '<i class="fas fa-film"></i> Disable Animations' : 
            '<i class="fas fa-film"></i> Enable Animations';
    }

    function goToLandingPage() {
        const pageTransition = document.querySelector('.page-transition');
        
        // Show transition
        pageTransition.style.display = 'flex';
        pageTransition.classList.add('active');
        
        // Navigate after transition completes
        setTimeout(() => {
            window.location.href = 'landing.html';
        }, 1000);
    }

    async function runServerSimulation(algorithm, pageSize, totalMemory, pages) {
        try {
            const response = await fetch('/api/simulate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    algorithm,
                    pageSize,
                    totalMemory,
                    referenceString: pages
                })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            return await response.json();
        } catch (error) {
            console.error('Error calling simulation API:', error);
            throw error;
        }
    }

    function handlePageTransition(targetUrl) {
        const pageTransition = document.querySelector('.page-transition');
        
        // Show transition
        pageTransition.style.display = 'flex';
        pageTransition.classList.add('active');
        
        // Create dynamic circuit lines during transition
        const circuitInterval = setInterval(() => {
            const line = document.createElement('div');
            line.className = 'circuit-line';
            line.style.width = `${Math.random() * 100 + 50}px`;
            line.style.top = `${Math.random() * 100}%`;
            line.style.left = `${Math.random() * 100}%`;
            line.style.animationDelay = `${Math.random() * 2}s`;
            pageTransition.querySelector('.circuit-lines').appendChild(line);
            
            // Remove after animation
            setTimeout(() => line.remove(), 2000);
        }, 200);

        // Animate transition content
        gsap.to('.transition-content', {
            scale: 1.1,
            duration: 0.5,
            ease: 'power2.inOut',
            yoyo: true,
            repeat: 1
        });

        // Navigate after transition
        setTimeout(() => {
            clearInterval(circuitInterval);
            window.location.href = targetUrl;
        }, 1500);
    }

    // Show notification message
    function showNotification(message) {
        // Create notification element if it doesn't exist
        let notification = document.getElementById('notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            document.body.appendChild(notification);
        }
        
        // Set message and show notification
        notification.textContent = message;
        notification.classList.add('show');
        
        // Hide notification after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 5000);
    }
})