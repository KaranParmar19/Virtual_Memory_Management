class MemoryVisualization {
    constructor(memoryManager) {
        this.memoryManager = memoryManager;
        this.currentView = 'grid';
        this.showAnimation = true;
        this.animationsEnabled = true;
        this.performanceChart = null;
        this.patternsChart = null;
        
        this.setupCharts();
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Listen for memory events
        this.memoryManager.addListener((eventType, data) => {
            switch(eventType) {
                case 'allocation':
                    this.animateAllocation(data);
                    break;
                case 'deallocation':
                    this.animateDeallocation(data);
                    break;
                case 'stats':
                    this.updateStats(data);
                    break;
                case 'fragmentation':
                    this.updateFragmentationDisplay(data);
                    break;
                case 'processQueue':
                    this.updateProcessQueue(data.processes);
                    break;
            }
        });
    }

    updateMemoryMap() {
        const memoryGrid = document.getElementById('memoryGrid');
        if (!memoryGrid) return;

        // Create a document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Get memory data
        const memory = this.memoryManager.getMemorySnapshot();
        
        // Calculate total frames based on pageSize and totalMemory
        // Convert MB to bytes for calculation
        const totalMemoryBytes = this.memoryManager.totalMemory * 1024 * 1024;
        const pageSizeBytes = this.memoryManager.pageSize * 1024;
        const totalFrames = Math.ceil(totalMemoryBytes / pageSizeBytes);
        
        // Limit frames to a reasonable number for display (max 200)
        const maxFramesToShow = Math.min(totalFrames, 200);
        
        console.log(`Total frames: ${totalFrames}, Showing: ${maxFramesToShow}`);
        
        // Store previous state for animation
        const previousState = {};
        document.querySelectorAll('.memory-block').forEach(block => {
            const frameId = block.dataset.frameId;
            previousState[frameId] = {
                processId: block.dataset.processId,
                color: block.style.backgroundColor
            };
        });
        
        // Clear existing content
        memoryGrid.innerHTML = '';
        
        // Create memory blocks with staggered animation
        for (let i = 0; i < maxFramesToShow; i++) {
            const block = document.createElement('div');
            block.className = 'memory-block';
            block.dataset.frameId = i;
            
            // Check if frame is allocated
            const processId = memory[i];
            if (processId) {
                // Get process color based on ID
                const hue = (processId * 40) % 360;
                block.style.backgroundColor = `hsl(${hue}, 70%, 65%)`;
                block.dataset.processId = processId;
                block.classList.add('allocated');
                
                // Add tooltip with process info
                const process = this.memoryManager.processes.get(processId);
                if (process) {
                    block.title = `Process ${processId}\nSize: ${this.formatBytes(process.size)}\nFrame: ${i}`;
                } else {
                    block.title = `Process ${processId}\nFrame: ${i}`;
                }
                
                // Check if this is a newly allocated block
                if (!previousState[i] || previousState[i].processId !== processId) {
                    block.classList.add('updated');
                }
            } else {
                block.style.backgroundColor = '#e5e7eb';
                block.title = `Empty Frame ${i}`;
                
                // Check if this was previously allocated
                if (previousState[i] && previousState[i].processId) {
                    block.classList.add('updated');
                }
            }
            
            // Set initial scale for animation
            block.style.opacity = '0';
            block.style.transform = 'scale(0.8)';
            
            fragment.appendChild(block);
        }
        
        // Add all blocks to the grid
        memoryGrid.appendChild(fragment);
        
        // Animate blocks appearance with staggered effect
        gsap.to('.memory-block', {
            opacity: 1,
            scale: 1,
            duration: 0.4,
            stagger: {
                amount: 0.8,
                grid: "auto",
                from: "center"
            },
            ease: "back.out(1.2)"
        });
    }

    setupCharts() {
        // Get canvas elements
        const perfCanvas = document.getElementById('performanceChart');
        const patternsCanvas = document.getElementById('patternsChart');
        
        // Clear any existing chart contexts
        if (perfCanvas.chart) {
            perfCanvas.chart.destroy();
        }
        if (patternsCanvas.chart) {
            patternsCanvas.chart.destroy();
        }
        
        // Performance Chart (Hit Ratio over time)
        this.performanceChart = new Chart(perfCanvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Hit Ratio (%)',
                        data: [],
                        borderColor: '#4CAF50',
                        tension: 0.4
                    },
                    {
                        label: 'Page Faults',
                        data: [],
                        borderColor: '#ff6b6b',
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: { display: true, text: 'Hit Ratio (%)' }
                    },
                    y1: {
                        position: 'right',
                        beginAtZero: true,
                        title: { display: true, text: 'Page Faults' },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
        perfCanvas.chart = this.performanceChart;
        
        // Memory Patterns Chart
        this.patternsChart = new Chart(patternsCanvas, {
            type: 'bar',
            data: {
                labels: ['Internal Frag', 'External Frag', 'Page Faults', 'Page Hits'],
                datasets: [{
                    label: 'Memory Metrics',
                    data: [0, 0, 0, 0],
                    backgroundColor: [
                        '#ffd166',  // Internal Frag - yellow
                        '#06d6a0',  // External Frag - teal
                        '#ef476f',  // Faults - pink
                        '#118ab2'   // Hits - blue
                    ],
                    borderColor: '#073b4c',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Count/Bytes' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.raw}`;
                            }
                        }
                    }
                }
            }
        });
        patternsCanvas.chart = this.patternsChart;
    }

    updateStats(stats) {
        // Update Performance Chart with animation
        const now = new Date();
        const timeLabel = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
        
        this.performanceChart.data.labels.push(timeLabel);
        this.performanceChart.data.datasets[0].data.push(stats.hitRatio * 100);
        this.performanceChart.data.datasets[1].data.push(stats.pageFaults);
        
        // Limit to 20 data points
        if (this.performanceChart.data.labels.length > 20) {
            this.performanceChart.data.labels.shift();
            this.performanceChart.data.datasets.forEach(dataset => dataset.data.shift());
        }
        
        this.performanceChart.update();

        // Update Patterns Chart with animation
        this.patternsChart.data.datasets[0].data = [
            stats.internalFragmentation,
            stats.externalFragmentation,
            stats.pageFaults,
            stats.pageHits
        ];
        
        this.patternsChart.update();
    }

    updateFragmentationDisplay(data) {
        const fragElement = document.getElementById('fragmentationValue');
        if (fragElement) {
            fragElement.textContent = `${(data.fragmentation * 100).toFixed(2)}%`;
            
            // Update fragmentation visualization
            const fragBlocks = document.querySelectorAll('.memory-block.internal-frag');
            fragBlocks.forEach(block => {
                block.style.opacity = Math.min(0.3 + (data.fragmentation * 0.7), 1);
            });
        }
    }

    updateProcessQueue(processes) {
        const queueElement = document.getElementById('processQueue');
        if (!queueElement) return;
        
        queueElement.innerHTML = '';
        
        processes.forEach(process => {
            const processElement = document.createElement('div');
            processElement.className = `process-item ${process.isAllocated ? 'bg-blue-100' : 'bg-gray-100'}`;
            processElement.textContent = `P${process.id}`;
            processElement.title = `Size: ${process.size} bytes\nDuration: ${(process.duration/1000).toFixed(2)}s`;
            
            queueElement.appendChild(processElement);
        });
    }

    resetCharts() {
        if (this.performanceChart) {
            this.performanceChart.destroy();
        }
        if (this.patternsChart) {
            this.patternsChart.destroy();
        }
        
        // Reinitialize charts
        this.setupCharts();
    }

    formatBytes(bytes) {
        if (bytes < 1024) return bytes + " bytes";
        else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + " KB";
        else return (bytes / 1048576).toFixed(2) + " MB";
    }
    
    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    animateAllocation(data) {
        if (!this.animationsEnabled) {
            this.updateMemoryMap();
            return;
        }
        
        const { processId, frameId, animationType } = data;
        const block = document.querySelector(`.memory-block[data-frame-id="${frameId}"]`);
        
        if (!block) {
            this.updateMemoryMap();
            return;
        }
        
        // Get process color based on ID
        const hue = (processId * 40) % 360;
        
        // Create animation
        gsap.fromTo(block, 
            { 
                backgroundColor: '#e5e7eb',
                scale: 0.5,
                opacity: 0.5
            },
            { 
                backgroundColor: `hsl(${hue}, 70%, 65%)`,
                scale: 1,
                opacity: 1,
                duration: 0.5,
                ease: "back.out(1.7)",
                onComplete: () => {
                    block.dataset.processId = processId;
                    block.classList.add('allocated');
                    
                    // Add a flash effect
                    gsap.to(block, {
                        boxShadow: '0 0 10px rgba(255,255,255,0.8)',
                        duration: 0.3,
                        yoyo: true,
                        repeat: 1
                    });
                }
            }
        );
    }
    
    animateDeallocation(data) {
        if (!this.animationsEnabled) {
            this.updateMemoryMap();
            return;
        }
        
        const { frameId } = data;
        const block = document.querySelector(`.memory-block[data-frame-id="${frameId}"]`);
        
        if (!block) {
            this.updateMemoryMap();
            return;
        }
        
        // Create animation
        gsap.to(block, {
            backgroundColor: '#e5e7eb',
            scale: 0.8,
            opacity: 0.7,
            duration: 0.4,
            ease: "power2.inOut",
            onComplete: () => {
                delete block.dataset.processId;
                block.classList.remove('allocated');
                
                // Restore to normal
                gsap.to(block, {
                    scale: 1,
                    opacity: 1,
                    duration: 0.3
                });
            }
        });
    }
}