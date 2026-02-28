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
        this.fragmentationStats = { internal: 0, external: 0 };

        // --- Expert OS Additions ---
        // Translation Lookaside Buffer (Hardware Cache for Page Tables)
        this.tlbSize = 4; // realistic small TLB
        this.tlb = new Map(); // key: processId_pageId, value: frameId
        this.tlbHits = 0;
        this.tlbMisses = 0;

        // Swap Space (Disk backing store)
        this.swapSpace = new Map(); // key: processId_pageId, value: swapLocation

        // System Console Logs
        this.systemLogs = [];
    }

    logSystemEvent(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] [Kernel] ${message}`;
        this.systemLogs.push({ message: logEntry, type });
        this.notifyListeners('systemLog', { message: logEntry, type });
        console.log(logEntry);
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

    getReplacementAlgorithmName(algorithm) {
        // Just a helper to format the name consistently
        const formatMap = {
            'lru': 'LRU',
            'fifo': 'FIFO',
            'optimal': 'Optimal',
            'hybrid': 'Hybrid',
            'adaptive': 'Adaptive',
            'clock': 'Clock' // Added Clock Algorithm
        };
        return formatMap[algorithm.toLowerCase()] || 'FIFO';
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

    getReplacementAlgorithm(algorithmId, pageAccesses) {
        let resultFrames = [...this.frameTable];
        let pageFaults = [];
        let faultsCount = 0;
        let hitsCount = 0;

        const algorithm = this.getReplacementAlgorithmName(algorithmId);
        const currentProcess = this.processes.get(this.currentExecutingProcess);

        // Ensure algorithm state structures exist
        if (!this.fifoQueue) this.fifoQueue = [];
        if (!this.lruHistory) this.lruHistory = [];
        if (!this.lfuFrequency) this.lfuFrequency = new Map();
        if (this.clockHand === undefined) this.clockHand = 0; // Clock hand points to frame index

        pageAccesses.forEach((logicalPage, index) => {
            // Update Frequency for LFU/Hybrid/Adaptive
            this.lfuFrequency.set(logicalPage, (this.lfuFrequency.get(logicalPage) || 0) + 1);

            // 1. TLB Lookup
            let frameIdx = currentProcess ? this.checkTLB(currentProcess.id, logicalPage) : -1;
            let isHit = false;

            // 2. Page Table Walk (if TLB Miss)
            if (frameIdx === -1 && currentProcess && currentProcess.pageTable[logicalPage]) {
                const ptEntry = currentProcess.pageTable[logicalPage];
                if (ptEntry.valid) {
                    frameIdx = ptEntry.frameId;
                    this.logSystemEvent(`Page Table HIT: Page ${logicalPage} -> Frame ${frameIdx}`, 'success');
                    // Add to TLB
                    this.updateTLB(currentProcess.id, logicalPage, frameIdx);
                } else {
                    this.logSystemEvent(`Page Table MISS (Fault): Page ${logicalPage} not in memory`, 'error');
                }
            }

            // Fallback for simulation if no process context
            if (!currentProcess) {
                frameIdx = resultFrames.indexOf(logicalPage);
            }

            if (frameIdx === -1 || !resultFrames.includes(logicalPage)) {
                // Page fault
                pageFaults.push(true);
                faultsCount++;

                if (resultFrames.includes(null)) {
                    // Empty frame available
                    const emptyIndex = resultFrames.indexOf(null);
                    resultFrames[emptyIndex] = logicalPage;

                    // Update Process Page Table
                    if (currentProcess && currentProcess.pageTable[logicalPage]) {
                        currentProcess.pageTable[logicalPage].frameId = emptyIndex;
                        currentProcess.pageTable[logicalPage].valid = true;
                        currentProcess.pageTable[logicalPage].inSwap = false;
                        this.logSystemEvent(`Loaded Page ${logicalPage} from Swap to Frame ${emptyIndex}`, 'info');
                        this.updateTLB(currentProcess.id, logicalPage, emptyIndex);
                    }

                    // Track for algorithms
                    this.fifoQueue.push(logicalPage);
                    this.lruHistory.push(logicalPage);
                } else {
                    // Replace based on algorithm
                    let replaceIndex = -1;
                    let evictedPage = null;

                    if (algorithm === 'FIFO') {
                        if (this.fifoQueue.length > 0) {
                            evictedPage = this.fifoQueue.shift();
                            replaceIndex = resultFrames.indexOf(evictedPage);
                            this.fifoQueue.push(logicalPage);
                            this.lruHistory.push(logicalPage);
                        }
                    } else if (algorithm === 'LRU') {
                        let oldestIndex = Infinity;
                        resultFrames.forEach(framePage => {
                            const lastUsed = this.lruHistory.lastIndexOf(framePage);
                            if (lastUsed < oldestIndex) {
                                oldestIndex = lastUsed;
                                evictedPage = framePage;
                            }
                        });
                        replaceIndex = resultFrames.indexOf(evictedPage);
                        this.lruHistory.push(logicalPage);
                    } else if (algorithm === 'Optimal') {
                        let farthest = -1;
                        for (let j = 0; j < resultFrames.length; j++) {
                            const nextOccurrence = pageAccesses.slice(index + 1).indexOf(resultFrames[j]);
                            if (nextOccurrence === -1) {
                                replaceIndex = j;
                                evictedPage = resultFrames[j];
                                break;
                            }
                            if (nextOccurrence > farthest) {
                                farthest = nextOccurrence;
                                replaceIndex = j;
                                evictedPage = resultFrames[j];
                            }
                        }
                        this.lruHistory.push(logicalPage);
                    } else if (algorithm === 'Hybrid') {
                        let lowestScore = Infinity;
                        resultFrames.forEach(framePage => {
                            const recencyRank = this.lruHistory.lastIndexOf(framePage);
                            const frequencyCount = this.lfuFrequency.get(framePage) || 0;
                            const score = frequencyCount + (recencyRank > 0 ? recencyRank * 0.1 : 0);

                            if (score < lowestScore) {
                                lowestScore = score;
                                evictedPage = framePage;
                            }
                        });
                        replaceIndex = resultFrames.indexOf(evictedPage);
                        this.lruHistory.push(logicalPage);
                    } else if (algorithm === 'Adaptive') {
                        const lruHits = this.algorithmStats['lru'] ? this.algorithmStats['lru'].hits : 0;
                        const optimalHits = this.algorithmStats['optimal'] ? this.algorithmStats['optimal'].hits : 0;

                        if (lruHits > optimalHits) {
                            let oldestIndex = Infinity;
                            resultFrames.forEach(framePage => {
                                const lastUsed = this.lruHistory.lastIndexOf(framePage);
                                if (lastUsed < oldestIndex) {
                                    oldestIndex = lastUsed;
                                    evictedPage = framePage;
                                }
                            });
                            replaceIndex = resultFrames.indexOf(evictedPage);
                        } else {
                            if (this.fifoQueue.length > 0) {
                                evictedPage = this.fifoQueue.shift();
                                replaceIndex = resultFrames.indexOf(evictedPage);
                                this.fifoQueue.push(logicalPage);
                            } else {
                                replaceIndex = 0;
                                evictedPage = resultFrames[0];
                            }
                        }
                        this.lruHistory.push(logicalPage);
                    } else if (algorithm === 'Clock') {
                        // Clock (Second Chance) Algorithm
                        let found = false;
                        let loopCount = 0;

                        while (!found && loopCount <= resultFrames.length * 2) {
                            const framePage = resultFrames[this.clockHand];
                            let pageTableEntry = null;

                            // Find the process that owns this page
                            if (currentProcess && currentProcess.pageTable[framePage]) {
                                pageTableEntry = currentProcess.pageTable[framePage];
                            } else {
                                // Search all processes if we changed context
                                for (let p of this.processes.values()) {
                                    if (p.pageTable && p.pageTable[framePage] && p.pageTable[framePage].frameId === this.clockHand) {
                                        pageTableEntry = p.pageTable[framePage];
                                        break;
                                    }
                                }
                            }

                            if (!pageTableEntry || !pageTableEntry.reference) {
                                // Evict this page
                                replaceIndex = this.clockHand;
                                evictedPage = framePage;
                                found = true;
                            } else {
                                // Give second chance, clear reference bit
                                pageTableEntry.reference = false;
                            }

                            // Advance clock hand
                            this.clockHand = (this.clockHand + 1) % resultFrames.length;
                            loopCount++;
                        }

                        if (!found && resultFrames.length > 0) {
                            // Failsafe eviction
                            replaceIndex = 0;
                            evictedPage = resultFrames[0];
                        }
                        this.lruHistory.push(logicalPage);
                    } else { // Fallback LRU
                        let oldestIndex = Infinity;
                        resultFrames.forEach(framePage => {
                            const lastUsed = this.lruHistory.lastIndexOf(framePage);
                            if (lastUsed < oldestIndex) {
                                oldestIndex = lastUsed;
                                evictedPage = framePage;
                            }
                        });
                        replaceIndex = resultFrames.indexOf(evictedPage);
                        this.lruHistory.push(logicalPage);
                    }

                    // Execute Replacement
                    if (replaceIndex !== -1 && replaceIndex < resultFrames.length) {
                        resultFrames[replaceIndex] = logicalPage;

                        // OS Actions: Evict old page, load new page
                        if (currentProcess) {
                            if (evictedPage !== null && currentProcess.pageTable[evictedPage]) {
                                currentProcess.pageTable[evictedPage].valid = false;
                                currentProcess.pageTable[evictedPage].inSwap = true;
                                currentProcess.pageTable[evictedPage].frameId = -1;
                                this.logSystemEvent(`Evicted Page ${evictedPage} to Swap`, 'warning');

                                // Flush TLB for evicted page
                                this.tlb.delete(`${currentProcess.id}_${evictedPage}`);
                            }

                            if (currentProcess.pageTable[logicalPage]) {
                                currentProcess.pageTable[logicalPage].frameId = replaceIndex;
                                currentProcess.pageTable[logicalPage].valid = true;
                                currentProcess.pageTable[logicalPage].inSwap = false;
                                this.logSystemEvent(`Loaded Page ${logicalPage} into Frame ${replaceIndex}`, 'info');
                                this.updateTLB(currentProcess.id, logicalPage, replaceIndex);
                            }
                        }
                    }
                }
            } else {
                // Page hit
                pageFaults.push(false);
                hitsCount++;

                // Track for LRU
                this.lruHistory.push(logicalPage);

                if (currentProcess && currentProcess.pageTable[logicalPage]) {
                    currentProcess.pageTable[logicalPage].reference = true; // Update hardware reference bit
                }
            }
        });

        // Update stats
        const algoKey = algorithm.toLowerCase();
        if (this.algorithmStats[algoKey]) {
            this.algorithmStats[algoKey].faults += faultsCount;
            this.algorithmStats[algoKey].hits += hitsCount;
        }

        // Add TLB stats to metrics
        this.metrics.tlbHits = this.tlbHits;
        this.metrics.tlbMisses = this.tlbMisses;
        const totalTlbAccesses = this.tlbHits + this.tlbMisses;
        this.metrics.tlbHitRatio = totalTlbAccesses > 0 ? ((this.tlbHits / totalTlbAccesses) * 100).toFixed(2) : 0;

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

            // Update Page Table
            process.pageTable.forEach(entry => {
                if (entry.frameId === frameIndex) {
                    entry.frameId = -1;
                    entry.valid = false;
                    entry.inSwap = true;
                }
            });
        });

        // Flush TLB for this process
        for (let key of this.tlb.keys()) {
            if (key.startsWith(`${processId}_`)) {
                this.tlb.delete(key);
            }
        }

        this.processes.delete(processId);
        this.logSystemEvent(`Process terminated: P${processId}. Memory reclaimed.`, 'success');
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

        this.fragmentationStats = {
            internal: internalFragmentation,
            external: externalFragmentation
        };

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

        // Detect Thrashing Condition (Working Set logic)
        // High page fault rate + High memory utilization
        const recentFaultRate = this.pageFaults > 0 ? (this.pageFaults / (this.pageFaults + this.pageHits)) : 0;
        const memoryUtilization = usedFrames / totalFrames;
        const isThrashing = memoryUtilization > 0.85 && recentFaultRate > 0.4;

        if (isThrashing && !this.wasThrashing) {
            this.logSystemEvent("CRITICAL: Thrashing detected! Page fault rate too high. CPU spending more time paging than executing.", "error");
            this.wasThrashing = true;
        } else if (!isThrashing && this.wasThrashing) {
            this.logSystemEvent("System recovered from thrashing.", "success");
            this.wasThrashing = false;
        }

        // Update metrics object
        this.metrics = {
            hits: this.pageHits,
            misses: this.pageFaults,
            pageHits: this.pageHits,
            pageFaults: this.pageFaults,
            hitRatio: hitRatio.toFixed(2),
            fragmentation: fragmentationPercent.toFixed(2),
            internalFragmentation: this.fragmentationStats.internal,
            externalFragmentation: this.fragmentationStats.external,
            throughput: throughput.toFixed(2),
            isThrashing,
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

        const requiredPages = Math.ceil(size / this.pageSize);

        // Initialize a per-process Page Table (Hardware structure)
        const processPageTable = new Array(requiredPages).fill(null).map(() => ({
            frameId: -1,         // -1 indicates not in physical memory (on disk/swap)
            valid: false,        // Valid/Invalid bit
            dirty: false,        // Dirty bit (modified)
            reference: false,    // Reference bit (accessed)
            inSwap: true         // All pages start in swap/disk conceptually
        }));

        this.processes.set(processId, {
            id: processId,
            size: size,
            duration: duration,
            totalPages: requiredPages,
            pageTable: processPageTable,
            frames: new Set(),
            isAllocated: false,
            isCompleted: false
        });

        this.logSystemEvent(`Process created: P${processId} (${size} bytes, ${requiredPages} pages)`, 'process');
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

        // Find a logical page to back this physical frame
        // For simulation, just pick the first invalid page
        const logicalPage = process.pageTable.findIndex(p => !p.valid);
        if (logicalPage !== -1) {
            process.pageTable[logicalPage].frameId = frameId;
            process.pageTable[logicalPage].valid = true;
            process.pageTable[logicalPage].inSwap = false;

            // Add to TLB simulation
            this.updateTLB(processId, logicalPage, frameId);
        }

        this.logSystemEvent(`Allocated Frame ${frameId} to P${processId} (Page ${logicalPage !== -1 ? logicalPage : 'N/A'})`, 'info');
        this.notifyListeners('allocation', { processId, frameId });
        return true;
    }

    // TLB Simulation Methods
    updateTLB(processId, pageId, frameId) {
        const tlbKey = `${processId}_${pageId}`;

        // If TLB is full and we don't have this key, evict one (using FIFO for TLB)
        if (this.tlb.size >= this.tlbSize && !this.tlb.has(tlbKey)) {
            const firstKey = this.tlb.keys().next().value;
            this.tlb.delete(firstKey);
        }

        this.tlb.set(tlbKey, frameId);
        this.notifyListeners('tlbUpdate', { tlb: Array.from(this.tlb.entries()) });
    }

    checkTLB(processId, pageId) {
        const tlbKey = `${processId}_${pageId}`;
        this.logSystemEvent(`TLB Lookup: ${tlbKey}`, 'lookup');

        if (this.tlb.has(tlbKey)) {
            this.tlbHits++;
            this.logSystemEvent(`TLB HIT: ${tlbKey} -> Frame ${this.tlb.get(tlbKey)}`, 'success');
            return this.tlb.get(tlbKey);
        } else {
            this.tlbMisses++;
            this.logSystemEvent(`TLB MISS: ${tlbKey}`, 'error');
            return -1;
        }
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
