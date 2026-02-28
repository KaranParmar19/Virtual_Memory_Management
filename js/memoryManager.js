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

        switch (algorithm) {
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

    getReplacementAlgorithm(algorithm, pageAccesses) {
        let resultFrames = [...this.frameTable];
        let pageFaults = [];
        let faultsCount = 0;
        let hitsCount = 0;

        // Ensure algorithm state structures exist
        if (!this.fifoQueue) this.fifoQueue = [];
        if (!this.lruHistory) this.lruHistory = [];

        pageAccesses.forEach((page, index) => {
            if (!resultFrames.includes(page)) {
                // Page fault
                pageFaults.push(true);
                faultsCount++;

                if (resultFrames.includes(null)) {
                    // Empty frame available
                    const emptyIndex = resultFrames.indexOf(null);
                    resultFrames[emptyIndex] = page;

                    // Track for algorithms
                    this.fifoQueue.push(page);
                    this.lruHistory.push(page);
                } else {
                    // Replace based on algorithm
                    let replaceIndex = -1;

                    if (algorithm === 'FIFO') {
                        if (this.fifoQueue.length > 0) {
                            const oldest = this.fifoQueue.shift();
                            replaceIndex = resultFrames.indexOf(oldest);
                            this.fifoQueue.push(page);
                            this.lruHistory.push(page);
                        }
                    } else if (algorithm === 'LRU') {
                        // Find least recently used page in frames
                        let lruPage = null;
                        let oldestIndex = Infinity;

                        resultFrames.forEach(framePage => {
                            const lastUsed = this.lruHistory.lastIndexOf(framePage);
                            if (lastUsed < oldestIndex) {
                                oldestIndex = lastUsed;
                                lruPage = framePage;
                            }
                        });

                        replaceIndex = resultFrames.indexOf(lruPage);
                        this.lruHistory.push(page);
                    } else if (algorithm === 'Optimal') {
                        // Look ahead in pageAccesses
                        let farthest = -1;
                        for (let j = 0; j < resultFrames.length; j++) {
                            const nextOccurrence = pageAccesses.slice(index + 1).indexOf(resultFrames[j]);
                            if (nextOccurrence === -1) {
                                replaceIndex = j;
                                break; // Will never be used again, perfect candidate
                            }
                            if (nextOccurrence > farthest) {
                                farthest = nextOccurrence;
                                replaceIndex = j;
                            }
                        }
                        this.lruHistory.push(page);
                    } else { // Fallback to LRU exactly
                        let lruPage = null;
                        let oldestIndex = Infinity;
                        resultFrames.forEach(framePage => {
                            const lastUsed = this.lruHistory.lastIndexOf(framePage);
                            if (lastUsed < oldestIndex) {
                                oldestIndex = lastUsed;
                                lruPage = framePage;
                            }
                        });
                        replaceIndex = resultFrames.indexOf(lruPage);
                        this.lruHistory.push(page);
                    }

                    if (replaceIndex !== -1 && replaceIndex < resultFrames.length) {
                        resultFrames[replaceIndex] = page;
                    }
                }
            } else {
                // Page hit
                pageFaults.push(false);
                hitsCount++;

                // Track for LRU
                this.lruHistory.push(page);
            }
        });

        // Update stats
        const algoKey = algorithm.toLowerCase();
        if (this.algorithmStats[algoKey]) {
            this.algorithmStats[algoKey].faults += faultsCount;
            this.algorithmStats[algoKey].hits += hitsCount;
        }

        return { frames: resultFrames, pageFaults };
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
