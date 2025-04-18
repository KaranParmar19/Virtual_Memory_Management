class MemoryManager {

    constructor(pageSize, totalMemory) {
        this.pageSize = pageSize * 1024; // Convert to bytes
        this.totalMemory = totalMemory * 1024 * 1024; // Convert to bytes
        this.totalPages = Math.floor(this.totalMemory / this.pageSize);
        this.pageTable = new Array(this.totalPages).fill(null);
        this.frameTable = new Array(this.totalPages).fill(null);
        this.pageFaults = 0;
        this.pageHits = 0;
        this.processes = new Map();
        this.freeFrames = [...Array(this.totalPages).keys()];
        this.pageFrequency = new Map(); // For LFU component
        this.pageHistory = []; // For LRU component
        this.listeners = new Set(); // For animation events
        this.algorithmStats = {
            lru: { faults: 0, hits: 0 },
            optimal: { faults: 0, hits: 0 },
            fifo: { faults: 0, hits: 0 },
            hybrid: { faults: 0, hits: 0 },
            adaptive: { faults: 0, hits: 0 }
        };
        this.learningRate = 0.1;
        this.weights = { lru: 0.5, lfu: 0.5 };
        this.startTime = performance.now();
        this.metrics = {
            hits: 0,
            misses: 0,
            pageFaults: 0,
            replacements: 0
        };
        this.lastUsed = new Map();
        this.currentExecutingProcess = null; // Track current executing process
    }

    addListener(callback) {
        this.listeners.add(callback);
    }

    removeListener(callback) {
        this.listeners.delete(callback);
    }

    notifyListeners(eventType, data) {
        // Add animation data
        if (eventType === 'allocation') {
            data.animationType = 'allocate';
            data.timestamp = Date.now();
        } else if (eventType === 'deallocation') {
            data.animationType = 'deallocate';
            data.timestamp = Date.now();
        }
        
        this.listeners.forEach(listener => {
            listener(eventType, data);
        });
    }

    getReplacementAlgorithm(algorithm, pages) {
        console.log(`Running ${algorithm} algorithm with pages:`, pages);
        
        switch(algorithm) {
            case 'lru': return this.lruReplacement(pages);
            case 'fifo': return this.fifoReplacement(pages);
            case 'optimal': return this.optimalReplacement(pages);
            case 'hybrid': return this.hybridReplacement(pages);
            case 'adaptive': return this.adaptiveReplacement(pages);
            default: return this.fifoReplacement(pages);
        }
    }

    allocateMemory(processId, size) {
        const requiredPages = Math.ceil(size / this.pageSize);
        const allocatedFrames = new Set();

        // Try to find contiguous frames first
        let contiguousStart = -1;
        let contiguousCount = 0;

        for (let i = 0; i < this.frameTable.length; i++) {
            if (this.frameTable[i] === null) {
                if (contiguousCount === 0) contiguousStart = i;
                contiguousCount++;
                if (contiguousCount === requiredPages) {
                    // Found enough contiguous frames
                    for (let j = 0; j < requiredPages; j++) {
                        const frameIndex = contiguousStart + j;
                        this.frameTable[frameIndex] = processId;
                        allocatedFrames.add(frameIndex);
                        
                        // Trigger animation
                        this.notifyListeners('allocation', {
                            processId,
                            frameIndex,
                            isContiguous: true
                        });
                    }
                    break;
                }
            } else {
                contiguousCount = 0;
            }
        }

        // If couldn't find contiguous frames, allocate non-contiguous
        if (allocatedFrames.size < requiredPages) {
            let allocated = 0;
            for (let i = 0; i < this.frameTable.length && allocated < requiredPages; i++) {
                if (this.frameTable[i] === null) {
                    this.frameTable[i] = processId;
                    allocatedFrames.add(i);
                    allocated++;
                    
                    // Trigger animation
                    this.notifyListeners('allocation', {
                        processId,
                        frameIndex: i,
                        isContiguous: false
                    });
                }
            }
        }

        if (allocatedFrames.size === requiredPages) {
            this.processes.set(processId, {
                size: size,
                frames: allocatedFrames
            });
            this.updateFragmentation();
            return allocatedFrames;
        }

        return null;
    }

    // Fixed FIFO implementation
    fifoReplacement(pages) {
        // Initialize queue if it doesn't exist
        if (!this.fifoQueue) {
            this.fifoQueue = [];
        }
        
        const frames = [...this.frameTable];
        const pageFaults = [];
        
        pages.forEach(page => {
            if (!frames.includes(page)) {
                // Page fault occurred
                this.pageFaults++;
                this.algorithmStats.fifo.faults++;
                pageFaults.push(true);
                
                if (frames.includes(null)) {
                    // There are free frames
                    const emptyIndex = frames.indexOf(null);
                    frames[emptyIndex] = page;
                    this.fifoQueue.push(page);
                } else {
                    // Need to replace a page
                    if (this.fifoQueue.length > 0) {
                        const oldest = this.fifoQueue.shift();
                        const replaceIndex = frames.indexOf(oldest);
                        if (replaceIndex !== -1) {
                            frames[replaceIndex] = page;
                            this.fifoQueue.push(page);
                        }
                    }
                }
            } else {
                // Page hit
                this.pageHits++;
                this.algorithmStats.fifo.hits++;
                pageFaults.push(false);
            }
        });
        
        // Update the actual frame table
        this.frameTable = frames;
        
        // Notify listeners about the update
        this.notifyListeners('stats', {
            pageFaults: this.pageFaults,
            pageHits: this.pageHits,
            hitRatio: this.pageHits / (this.pageHits + this.pageFaults),
            fragmentation: this.calculateFragmentation()
        });
        
        return { frames, pageFaults };
    }

    deallocateMemory(processId) {
        const process = this.processes.get(processId);
        if (!process) return false;

        process.frames.forEach(frameIndex => {
            this.frameTable[frameIndex] = null;
            // Trigger animation
            this.notifyListeners('deallocation', {
                processId,
                frameIndex
            });
        });

        this.processes.delete(processId);
        this.updateFragmentation();
        return true;
    }

    updateFragmentation() {
        let internalFragmentation = 0;
        let externalFragmentation = 0;
        let lastFreeFrame = -1;
        let currentFreeBlock = 0;

        this.frameTable.forEach((frame, index) => {
            if (frame === null) {
                currentFreeBlock++;
                if (lastFreeFrame !== index - 1) {
                    // New free block started
                    externalFragmentation++;
                }
                lastFreeFrame = index;
            } else {
                const process = this.processes.get(frame);
                if (process) {
                    const frameSize = this.pageSize;
                    const wastedSpace = frameSize - (process.size % frameSize);
                    if (wastedSpace < frameSize) {
                        internalFragmentation += wastedSpace;
                    }
                }
            }
        });

        // Notify listeners about fragmentation update
        this.notifyListeners('fragmentation', {
            internal: internalFragmentation,
            external: externalFragmentation,
            freeBlocks: currentFreeBlock
        });
    }

    getStats() {
        // Calculate elapsed time in seconds
        const elapsedTime = (performance.now() - this.startTime) / 1000;
        
        // Calculate hit ratio (avoid division by zero)
        const totalAccesses = this.pageHits + this.pageFaults;
        const hitRatio = totalAccesses > 0 ? (this.pageHits / totalAccesses) * 100 : 0;
        
        // Calculate fragmentation
        const totalFrames = this.frameTable.length;
        const usedFrames = this.frameTable.filter(frame => frame !== null).length;
        const fragmentationPercent = this.calculateFragmentation();
        
        // Calculate throughput (operations per second)
        const throughput = elapsedTime > 0 ? totalAccesses / elapsedTime : 0;
        
        // Update metrics object
        this.metrics = {
            hits: this.pageHits,
            misses: this.pageFaults,
            hitRatio: hitRatio.toFixed(2),
            fragmentation: fragmentationPercent.toFixed(2),
            throughput: throughput.toFixed(2),
            usedFrames,
            totalFrames
        };
        
        return this.metrics;
    }
    
    // Calculate memory fragmentation percentage
    calculateFragmentation() {
        const totalFrames = this.frameTable.length;
        let fragmentCount = 0;
        let inFragment = false;
        
        // Count fragments (contiguous unused frames)
        for (let i = 0; i < totalFrames; i++) {
            if (this.frameTable[i] === null) {
                if (!inFragment) {
                    fragmentCount++;
                    inFragment = true;
                }
            } else {
                inFragment = false;
            }
        }
        
        // Calculate external fragmentation percentage
        // Higher number of fragments means more fragmentation
        const maxPossibleFragments = Math.ceil(totalFrames / 2); // Worst case: alternating used/unused
        return fragmentCount > 0 ? (fragmentCount / maxPossibleFragments) * 100 : 0;
    }

    getMemoryState() {
        return this.frameTable.map((processId, index) => {
            if (processId === null) {
                return { type: 'free', index };
            }
            
            const process = this.processes.get(processId);
            if (!process) {
                return { type: 'free', index }; // Handle orphaned frames
            }
            
            // Calculate fragmentation for allocated frames
            const frameSize = this.pageSize;
            const wastedSpace = frameSize - (process.size % frameSize);
            
            return {
                type: wastedSpace > 0 ? 'internal' : 'used',
                index,
                processId,
                internalFragmentation: wastedSpace > 0 ? wastedSpace : 0
            };
        });
    }

    getMemorySnapshot() {
        return this.frameTable;
    }

    // LRU implementation
    lruReplacement(pages) {
        const pageHistory = [];
        const pageFaults = [];
        const frames = new Array(this.frameTable.length).fill(null);
        
        pages.forEach(page => {
            if (!frames.includes(page)) {
                this.pageFaults++;
                this.algorithmStats.lru.faults++;
                pageFaults.push(true);
                
                if (frames.includes(null)) {
                    // If there's an empty frame, use it
                    const emptyIndex = frames.findIndex(frame => frame === null);
                    frames[emptyIndex] = page;
                } else {
                    // Find the least recently used page
                    let leastRecentPage = null;
                    let leastRecentIndex = Infinity;
                    
                    // For each page in frames, find when it was last used
                    frames.forEach(frameContent => {
                        // Find the most recent use of this page (from the end)
                        const lastUsedIndex = pageHistory.lastIndexOf(frameContent);
                        
                        // If this page was used earlier than the current LRU page
                        if (lastUsedIndex < leastRecentIndex) {
                            leastRecentIndex = lastUsedIndex;
                            leastRecentPage = frameContent;
                        }
                    });
                    
                    // Replace the least recently used page
                    const frameIndex = frames.indexOf(leastRecentPage);
                    frames[frameIndex] = page;
                }
            } else {
                this.pageHits++;
                this.algorithmStats.lru.hits++;
                pageFaults.push(false);
            }
            
            // Add this page to history
            pageHistory.push(page);
        });

        return { frames, pageFaults };
    }

    // Hybrid LRU-LFU implementation
    hybridReplacement(pages) {
        const frames = new Array(this.frameTable.length).fill(null);
        const pageFaults = [];

        pages.forEach(page => {
            // Update frequency
            this.pageFrequency.set(page, (this.pageFrequency.get(page) || 0) + 1);
            
            if (!frames.includes(page)) {
                this.pageFaults++;
                this.algorithmStats.hybrid.faults++;
                pageFaults.push(true);

                if (frames.includes(null)) {
                    const emptyIndex = frames.findIndex(frame => frame === null);
                    frames[emptyIndex] = page;
                } else {
                    // Calculate hybrid score for each frame
                    const scores = frames.map(frame => {
                        const lruScore = this.pageHistory.lastIndexOf(frame) / this.pageHistory.length;
                        const lfuScore = this.pageFrequency.get(frame) / Math.max(...Array.from(this.pageFrequency.values()));
                        return this.weights.lru * lruScore + this.weights.lfu * lfuScore;
                    });

                    // Replace page with lowest score
                    const replaceIndex = scores.indexOf(Math.min(...scores));
                    frames[replaceIndex] = page;
                }
            } else {
                this.pageHits++;
                this.algorithmStats.hybrid.hits++;
                pageFaults.push(false);
            }

            this.pageHistory.push(page);
        });

        // Adjust weights based on performance
        this.updateHybridWeights();
        return { frames, pageFaults };
    }

    // Adaptive Learning implementation
    adaptiveReplacement(pages) {
        const frames = new Array(this.frameTable.length).fill(null);
        const pageFaults = [];
        const algorithms = ['lru', 'hybrid', 'optimal'];
        let currentAlgorithm = 'lru';
        let windowSize = 10;
        let windowFaults = new Map(algorithms.map(algo => [algo, 0]));

        pages.forEach((page, index) => {
            // Test each algorithm in a window
            if (index % windowSize === 0 && index > 0) {
                // Switch to best performing algorithm
                const bestAlgo = Array.from(windowFaults.entries())
                    .reduce((a, b) => a[1] < b[1] ? a : b)[0];
                currentAlgorithm = bestAlgo;
                windowFaults = new Map(algorithms.map(algo => [algo, 0]));
            }

            // Apply current algorithm
            let result;
            switch (currentAlgorithm) {
                case 'lru':
                    result = this.lruReplacement([page]);
                    break;
                case 'hybrid':
                    result = this.hybridReplacement([page]);
                    break;
                case 'optimal':
                    result = this.optimalReplacement(pages.slice(index));
                    break;
            }

            if (result.pageFaults[0]) {
                this.pageFaults++;
                this.algorithmStats.adaptive.faults++;
                pageFaults.push(true);
                windowFaults.set(currentAlgorithm, windowFaults.get(currentAlgorithm) + 1);
            } else {
                this.pageHits++;
                this.algorithmStats.adaptive.hits++;
                pageFaults.push(false);
            }

            frames.splice(0, frames.length, ...result.frames);
        });

        return { frames, pageFaults };
    }

    updateHybridWeights() {
        const lruHitRate = this.algorithmStats.lru.hits / 
            (this.algorithmStats.lru.hits + this.algorithmStats.lru.faults);
        const hybridHitRate = this.algorithmStats.hybrid.hits / 
            (this.algorithmStats.hybrid.hits + this.algorithmStats.hybrid.faults);

        // Adjust weights using gradient descent
        this.weights.lru += this.learningRate * (hybridHitRate - lruHitRate);
        this.weights.lfu = 1 - this.weights.lru;

        // Ensure weights stay in valid range
        this.weights.lru = Math.max(0.1, Math.min(0.9, this.weights.lru));
        this.weights.lfu = 1 - this.weights.lru;
    }

    // Optimal page replacement
    optimalReplacement(pages) {
        const frames = new Array(this.frameTable.length).fill(null);
        const pageFaults = [];

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            
            if (!frames.includes(page)) {
                this.pageFaults++;
                this.algorithmStats.optimal.faults++;
                pageFaults.push(true);

                if (frames.includes(null)) {
                    const emptyIndex = frames.findIndex(frame => frame === null);
                    frames[emptyIndex] = page;
                } else {
                    let farthest = -1;
                    let replaceIndex = 0;

                    for (let j = 0; j < frames.length; j++) {
                        let nextOccurrence = pages.slice(i + 1).indexOf(frames[j]);
                        
                        if (nextOccurrence === -1) {
                            replaceIndex = j;
                            break;
                        }
                        
                        if (nextOccurrence > farthest) {
                            farthest = nextOccurrence;
                            replaceIndex = j;
                        }
                    }
                    
                    frames[replaceIndex] = page;
                }
            } else {
                this.pageHits++;
                this.algorithmStats.optimal.hits++;
                pageFaults.push(false);
            }
        }

        return { frames, pageFaults };
    }

    getReplacementFrame(algorithm = 'FIFO') {
        this.metrics.replacements++;
        switch(algorithm) {
            case 'FIFO': return this.getFIFOReplacement();
            case 'LRU': return this.getLRUReplacement();
            case 'Optimal': return this.getOptimalReplacement();
        }
    }

    addProcess(processId, size, duration = 10000) {
        if (this.processes.has(processId)) {
            console.log(`Process ${processId} already exists`);
            return;
        }
        
        this.processes.set(processId, {
            id: processId,
            size: size,
            duration: duration,
            frames: new Set(),
            isAllocated: false,
            isCompleted: false
        });
        
        console.log(`Process ${processId} added with size ${size}`);
    }

    allocateFrame(processId, frameId) {
        console.log('[DEBUG] Attempting to allocate frame', frameId, 'to process', processId);
        
        if (!this.processes.has(processId)) {
            console.error('[ERROR] Process not found:', processId);
            return false;
        }

        if (this.frameTable[frameId] && this.frameTable[frameId] !== processId) {
            console.warn('[WARNING] Frame already allocated:', frameId);
            return false;
        }

        const process = this.processes.get(processId);
        process.frames.add(frameId);
        this.frameTable[frameId] = processId;
        
        console.log('[SUCCESS] Allocated frame', frameId, 'to process', processId);
        this.notifyListeners('allocation', { processId, frameId });
        return true;
    }

    // Set the current executing process
    setCurrentExecutingProcess(processId) {
        this.currentExecutingProcess = processId;
        this.notifyListeners('currentProcess', { processId });
    }

    // Get the current executing process
    getCurrentExecutingProcess() {
        return this.currentExecutingProcess;
    }
}
