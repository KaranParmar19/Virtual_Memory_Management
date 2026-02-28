class MemoryVisualization {
    constructor(memoryManager) {
        this.memoryManager = memoryManager;
        this.currentView = 'grid';
        this.showAnimation = true;
        this.animationsEnabled = true;
        this.performanceChart = null;
        this.patternsChart = null;

        // Tooltip Elements
        this.tooltip = document.getElementById('memoryTooltip');
        this.ttHeader = document.getElementById('ttHeader');
        this.ttStatus = document.getElementById('ttStatus');
        this.ttProcess = document.getElementById('ttProcess');
        this.ttPage = document.getElementById('ttPage');
        this.ttBits = document.getElementById('ttBits');
        this.ttAction = document.getElementById('ttAction');

        // Action Banner
        this.actionBanner = document.getElementById('actionBanner');
        this.actionBannerText = document.getElementById('actionBannerText');

        this.setupCharts();
        this.setupResizeListener();
        this.setupEventListeners();
    }

    setupResizeListener() {
        window.addEventListener('resize', () => {
            // Debounce resize events
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                const stats = this.memoryManager.getStats();
                const snapshot = this.memoryManager.getMemorySnapshot();
                this.renderMemoryBlocks(snapshot, stats);
                this.updateFragmentationDisplay({ fragmentation: stats.externalFragmentation });
                this.updateProcessQueue(Array.from(this.memoryManager.processes.values()));
            }, 250);
        });
    }

    setupEventListeners() {
        // Listen for memory events
        this.memoryManager.addListener((eventType, data) => {
            switch (eventType) {
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
                case 'pageHit':
                    this.animateFrameAction(data.frameIndex, 'hit');
                    this.showActionBanner(`Page Hit! Process ${data.processId}, Page ${data.logicalPage} found in Frame ${data.frameIndex}.`, 'hit');
                    break;
                case 'pageFault':
                    this.animateFrameAction(data.frameIndex, 'fault');
                    this.showActionBanner(`Page Fault! Process ${data.processId}, Page ${data.logicalPage} not in memory.`, 'fault');
                    break;
                case 'pageEvict':
                    this.animateFrameAction(data.frameIndex, 'evict');
                    this.showActionBanner(`Page Evicted! Frame ${data.frameIndex} was replaced.`, 'swap');
                    break;
            }
        });
    }

    renderMemoryBlocks(frames, stats) {
        const memoryGrid = document.getElementById('memoryGrid');
        if (!memoryGrid) return;

        // Clear existing content
        memoryGrid.innerHTML = '';

        // Extract metadata if available (added for Expert OS features)
        const frameMetadata = stats && stats.frameMetadata ? stats.frameMetadata : [];

        // Track frame references for tooltips
        this.frameElements = [];

        for (let i = 0; i < stats.totalFrames; i++) {
            const block = document.createElement('div');
            block.className = 'memory-block';

            // Get detailed OS metadata for this frame
            const metadata = frameMetadata[i] || { status: 'Free' };

            if (frames[i] !== null) {
                block.classList.add('used');
                const processColor = this.getProcessColor(frames[i]);
                block.style.backgroundColor = processColor;

                // Keep track of the owner for linking
                block.dataset.processId = frames[i];
            } else {
                block.classList.add('free');
                block.dataset.processId = 'none';
            }

            // Bind tooltip events
            block.addEventListener('mouseover', (e) => this.showTooltip(e, i, metadata));
            block.addEventListener('mouseout', () => this.hideTooltip());
            block.addEventListener('mousemove', (e) => this.moveTooltip(e));

            memoryGrid.appendChild(block);
            this.frameElements.push(block);
        }
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
                            label: function (context) {
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
                            label: function (context) {
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
        this.performanceChart.data.datasets[0].data.push(parseFloat(stats.hitRatio));
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
            processElement.title = `Size: ${process.size} bytes\nDuration: ${(process.duration / 1000).toFixed(2)}s`;

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