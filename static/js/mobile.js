// Mobile Navigation Assistant JavaScript

class MobileNavigationApp {
    constructor() {
        this.socket = io();
        this.cameraStream = null;
        this.isNavigationRunning = false;
        this.analysisCanvas = null;
        this.analysisContext = null;
        this.sensitivity = 50;
        this.voiceEnabled = true;
        
        this.initializeElements();
        this.setupEventHandlers();
        this.setupSocketHandlers();
        this.initializeCanvas();
    }

    initializeElements() {
        this.cameraVideo = document.getElementById('cameraVideo');
        this.cameraContainer = document.getElementById('cameraContainer');
        this.cameraPlaceholder = document.getElementById('cameraPlaceholder');
        this.distanceValue = document.getElementById('distanceValue');
        this.instructionText = document.getElementById('instructionText');
        this.instructionIcon = document.getElementById('instructionIcon');
        this.instructionCard = document.getElementById('instructionCard');
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        this.alertMessage = document.getElementById('alertMessage');
        
        // Controls
        this.cameraBtn = document.getElementById('cameraBtn');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.voiceToggle = document.getElementById('voiceToggle');
        this.sensitivitySlider = document.getElementById('sensitivitySlider');
        this.sensitivityValue = document.getElementById('sensitivityValue');
    }

    initializeCanvas() {
        this.analysisCanvas = document.getElementById('analysisCanvas');
        this.analysisContext = this.analysisCanvas.getContext('2d');
    }

    setupEventHandlers() {
        // Voice toggle
        this.voiceToggle.addEventListener('change', (e) => {
            this.voiceEnabled = e.target.checked;
            this.showAlert(this.voiceEnabled ? 'Voice guidance enabled' : 'Voice guidance disabled', 'success');
        });

        // Sensitivity slider
        this.sensitivitySlider.addEventListener('input', (e) => {
            this.sensitivity = parseInt(e.target.value);
            this.sensitivityValue.textContent = `${this.sensitivity}cm`;
        });

        // Prevent screen sleep during navigation
        document.addEventListener('visibilitychange', () => {
            if (this.isNavigationRunning && document.hidden) {
                // Try to keep the screen awake
                navigator.wakeLock?.request('screen');
            }
        });
    }

    setupSocketHandlers() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.showAlert('Connected to navigation system', 'success');
        });

        this.socket.on('navigation_update', (data) => {
            this.updateNavigationDisplay(data);
        });

        this.socket.on('navigation_started', () => {
            this.isNavigationRunning = true;
            this.updateControlStates();
            this.setStatus('running', 'Navigation Active');
        });

        this.socket.on('navigation_stopped', () => {
            this.isNavigationRunning = false;
            this.updateControlStates();
            this.setStatus('ready', 'Navigation Stopped');
        });
    }

    async toggleCamera() {
        if (this.cameraStream) {
            this.stopCamera();
        } else {
            await this.startCamera();
        }
    }

    async startCamera() {
        try {
            this.showAlert('Requesting camera permission...', 'info');
            
            const constraints = {
                video: {
                    facingMode: 'environment', // Use back camera
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: false
            };

            this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.cameraVideo.srcObject = this.cameraStream;
            
            this.cameraVideo.onloadedmetadata = () => {
                this.cameraPlaceholder.style.display = 'none';
                this.cameraVideo.style.display = 'block';
                this.cameraBtn.textContent = '📹 Stop Camera';
                this.startBtn.disabled = false;
                this.setStatus('camera-active', 'Camera Active');
                this.showAlert('Camera activated successfully!', 'success');
                
                // Setup canvas for analysis
                this.setupAnalysisCanvas();
            };

        } catch (error) {
            console.error('Camera error:', error);
            let errorMessage = 'Camera access denied';
            
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Please allow camera access and try again';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'No camera found on device';
            } else if (error.name === 'NotSupportedError') {
                errorMessage = 'Camera not supported in this browser';
            }
            
            this.showAlert(errorMessage, 'error');
        }
    }

    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
            this.cameraVideo.srcObject = null;
            this.cameraVideo.style.display = 'none';
            this.cameraPlaceholder.style.display = 'flex';
            this.cameraBtn.textContent = '📹 Enable Camera';
            this.startBtn.disabled = true;
            
            if (this.isNavigationRunning) {
                this.stopNavigation();
            }
            
            this.setStatus('ready', 'Camera Stopped');
        }
    }

    setupAnalysisCanvas() {
        this.analysisCanvas.width = this.cameraVideo.videoWidth;
        this.analysisCanvas.height = this.cameraVideo.videoHeight;
    }

    analyzeFrame() {
        if (!this.cameraStream || !this.analysisCanvas) return null;

        // Draw current video frame to canvas
        this.analysisContext.drawImage(
            this.cameraVideo, 
            0, 0, 
            this.analysisCanvas.width, 
            this.analysisCanvas.height
        );

        // Get image data for analysis
        const imageData = this.analysisContext.getImageData(
            0, 0, 
            this.analysisCanvas.width, 
            this.analysisCanvas.height
        );

        return this.processImageData(imageData);
    }

    processImageData(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        // Enhanced multi-method obstacle detection
        const analysis = this.performEnhancedAnalysis(data, width, height);
        
        // Apply temporal smoothing to reduce false alerts
        const smoothedDistance = this.applySmoothingFilter(analysis.distance);
        
        return {
            distance: Math.round(smoothedDistance),
            direction: analysis.direction,
            confidence: analysis.confidence,
            leftEdges: analysis.leftEdges,
            rightEdges: analysis.rightEdges
        };
    }
    
    performEnhancedAnalysis(data, width, height) {
        // Method 1: Edge-based detection with improved sensitivity
        const edgeAnalysis = this.analyzeEdges(data, width, height);
        
        // Method 2: Texture analysis for surface detection
        const textureAnalysis = this.analyzeTexture(data, width, height);
        
        // Method 3: Contrast analysis for depth estimation
        const contrastAnalysis = this.analyzeContrast(data, width, height);
        
        // Method 4: Ground plane analysis
        const groundAnalysis = this.analyzeGroundPlane(data, width, height);
        
        // Combine all methods with weighted confidence
        const combinedDistance = this.combineDistanceEstimates([
            { distance: edgeAnalysis.distance, weight: 0.3, confidence: edgeAnalysis.confidence },
            { distance: textureAnalysis.distance, weight: 0.25, confidence: textureAnalysis.confidence },
            { distance: contrastAnalysis.distance, weight: 0.25, confidence: contrastAnalysis.confidence },
            { distance: groundAnalysis.distance, weight: 0.2, confidence: groundAnalysis.confidence }
        ]);
        
        // Enhanced directional analysis
        const direction = this.determineOptimalDirection(edgeAnalysis, textureAnalysis);
        
        return {
            distance: combinedDistance.distance,
            direction: direction,
            confidence: combinedDistance.confidence,
            leftEdges: edgeAnalysis.leftEdges,
            rightEdges: edgeAnalysis.rightEdges
        };
    }
    
    analyzeEdges(data, width, height) {
        let leftEdges = 0, rightEdges = 0, totalEdges = 0;
        const edgeThreshold = 25; // Adjusted for better sensitivity
        
        // Focus on critical navigation area (middle to bottom)
        for (let y = Math.floor(height * 0.4); y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = (y * width + x) * 4;
                
                // Calculate gradient magnitude (Sobel-like)
                const gx = this.getGrayValue(data, i + 4) - this.getGrayValue(data, i - 4);
                const gy = this.getGrayValue(data, (y + 1) * width * 4 + x * 4) - 
                          this.getGrayValue(data, (y - 1) * width * 4 + x * 4);
                const magnitude = Math.sqrt(gx * gx + gy * gy);
                
                if (magnitude > edgeThreshold) {
                    totalEdges++;
                    if (x < width / 2) {
                        leftEdges++;
                    } else {
                        rightEdges++;
                    }
                }
            }
        }
        
        // Distance based on edge density in bottom region
        const bottomY = Math.floor(height * 0.7);
        let bottomEdges = 0;
        let bottomPixels = (height - bottomY) * width;
        
        for (let y = bottomY; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = (y * width + x) * 4;
                const gx = this.getGrayValue(data, i + 4) - this.getGrayValue(data, i - 4);
                const gy = this.getGrayValue(data, (y + 1) * width * 4 + x * 4) - 
                          this.getGrayValue(data, (y - 1) * width * 4 + x * 4);
                if (Math.sqrt(gx * gx + gy * gy) > edgeThreshold) {
                    bottomEdges++;
                }
            }
        }
        
        const edgeDensity = bottomEdges / bottomPixels;
        const distance = Math.max(25, Math.min(250, 180 - (edgeDensity * 2000)));
        
        return {
            distance: distance,
            confidence: Math.min(1.0, totalEdges / 1000),
            leftEdges: leftEdges,
            rightEdges: rightEdges
        };
    }
    
    analyzeTexture(data, width, height) {
        // Analyze texture patterns to detect surfaces and obstacles
        const blockSize = 8;
        let textureVariance = 0;
        let blockCount = 0;
        
        // Focus on lower portion of image
        const startY = Math.floor(height * 0.6);
        
        for (let y = startY; y < height - blockSize; y += blockSize) {
            for (let x = 0; x < width - blockSize; x += blockSize) {
                const variance = this.calculateBlockVariance(data, x, y, blockSize, width);
                textureVariance += variance;
                blockCount++;
            }
        }
        
        const avgVariance = blockCount > 0 ? textureVariance / blockCount : 0;
        
        // Higher variance = more texture = closer objects
        const distance = Math.max(30, Math.min(200, 150 - (avgVariance / 10)));
        
        return {
            distance: distance,
            confidence: Math.min(1.0, avgVariance / 1000)
        };
    }
    
    analyzeContrast(data, width, height) {
        // Analyze contrast changes to detect depth
        const centerX = Math.floor(width / 2);
        const roadWidth = Math.floor(width * 0.6);
        const startX = centerX - Math.floor(roadWidth / 2);
        const endX = centerX + Math.floor(roadWidth / 2);
        
        let totalContrast = 0;
        let contrastPoints = 0;
        
        // Scan vertically in center region
        for (let x = startX; x < endX; x += 4) {
            let previousGray = 0;
            for (let y = Math.floor(height * 0.5); y < height; y += 2) {
                const gray = this.getGrayValue(data, (y * width + x) * 4);
                if (y > Math.floor(height * 0.5)) {
                    totalContrast += Math.abs(gray - previousGray);
                    contrastPoints++;
                }
                previousGray = gray;
            }
        }
        
        const avgContrast = contrastPoints > 0 ? totalContrast / contrastPoints : 0;
        
        // Higher contrast = more detail = closer
        const distance = Math.max(25, Math.min(180, 140 - (avgContrast * 3)));
        
        return {
            distance: distance,
            confidence: Math.min(1.0, avgContrast / 50)
        };
    }
    
    analyzeGroundPlane(data, width, height) {
        // Detect ground plane to estimate distance
        const horizonY = Math.floor(height * 0.4);
        const groundY = Math.floor(height * 0.8);
        
        let groundBrightness = 0;
        let groundPixels = 0;
        
        // Sample ground region
        for (let y = groundY; y < height; y++) {
            for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x += 4) {
                groundBrightness += this.getGrayValue(data, (y * width + x) * 4);
                groundPixels++;
            }
        }
        
        const avgGroundBrightness = groundPixels > 0 ? groundBrightness / groundPixels : 128;
        
        // Detect brightness changes that indicate obstacles
        let obstacleIndicator = 0;
        for (let y = Math.floor(height * 0.6); y < groundY; y++) {
            for (let x = Math.floor(width * 0.3); x < Math.floor(width * 0.7); x += 2) {
                const brightness = this.getGrayValue(data, (y * width + x) * 4);
                if (Math.abs(brightness - avgGroundBrightness) > 30) {
                    obstacleIndicator++;
                }
            }
        }
        
        const distance = Math.max(20, Math.min(200, 120 - (obstacleIndicator / 10)));
        
        return {
            distance: distance,
            confidence: Math.min(1.0, obstacleIndicator / 500)
        };
    }
    
    getGrayValue(data, index) {
        return (data[index] + data[index + 1] + data[index + 2]) / 3;
    }
    
    calculateBlockVariance(data, startX, startY, blockSize, width) {
        let sum = 0;
        let sumSquares = 0;
        let count = 0;
        
        for (let y = startY; y < startY + blockSize; y++) {
            for (let x = startX; x < startX + blockSize; x++) {
                const gray = this.getGrayValue(data, (y * width + x) * 4);
                sum += gray;
                sumSquares += gray * gray;
                count++;
            }
        }
        
        if (count === 0) return 0;
        const mean = sum / count;
        const variance = (sumSquares / count) - (mean * mean);
        return variance;
    }
    
    combineDistanceEstimates(estimates) {
        let weightedSum = 0;
        let totalWeight = 0;
        let totalConfidence = 0;
        
        estimates.forEach(est => {
            const weight = est.weight * est.confidence;
            weightedSum += est.distance * weight;
            totalWeight += weight;
            totalConfidence += est.confidence;
        });
        
        const finalDistance = totalWeight > 0 ? weightedSum / totalWeight : 100;
        const avgConfidence = totalConfidence / estimates.length;
        
        return {
            distance: finalDistance,
            confidence: avgConfidence
        };
    }
    
    determineOptimalDirection(edgeAnalysis, textureAnalysis) {
        // Enhanced direction determination
        const edgeRatio = edgeAnalysis.leftEdges / (edgeAnalysis.rightEdges + 1);
        
        // Prefer direction with less obstacles (fewer edges)
        if (edgeRatio < 0.7) {
            return 'left';  // More space on left
        } else if (edgeRatio > 1.3) {
            return 'right'; // More space on right
        } else {
            return 'straight'; // Relatively clear ahead
        }
    }
    
    applySmoothingFilter(newDistance) {
        // Initialize history if needed
        if (!this.distanceHistory) {
            this.distanceHistory = [];
        }
        
        // Add new reading
        this.distanceHistory.push(newDistance);
        
        // Keep only last 5 readings for smoothing
        if (this.distanceHistory.length > 5) {
            this.distanceHistory.shift();
        }
        
        // Apply weighted moving average (recent readings have more weight)
        let weightedSum = 0;
        let totalWeight = 0;
        
        for (let i = 0; i < this.distanceHistory.length; i++) {
            const weight = i + 1; // More recent = higher weight
            weightedSum += this.distanceHistory[i] * weight;
            totalWeight += weight;
        }
        
        return weightedSum / totalWeight;
    }

    startNavigation() {
        if (!this.cameraStream) {
            this.showAlert('Please enable camera first', 'error');
            return;
        }

        this.socket.emit('start_navigation');
        
        // Start real-time analysis
        this.startAnalysisLoop();
    }

    stopNavigation() {
        this.socket.emit('stop_navigation');
        this.stopAnalysisLoop();
    }

    startAnalysisLoop() {
        this.analysisInterval = setInterval(() => {
            if (this.isNavigationRunning && this.cameraStream) {
                const analysis = this.analyzeFrame();
                if (analysis) {
                    // Enhanced instruction generation
                    const instruction = this.generateSmartInstruction(analysis);
                    
                    // Send analysis to server
                    this.socket.emit('camera_analysis', {
                        ...analysis,
                        instruction: instruction
                    });
                    
                    // Update local display with enhanced feedback
                    this.updateNavigationDisplay({
                        distance: analysis.distance,
                        direction: analysis.direction,
                        obstacle_detected: analysis.distance < this.sensitivity,
                        last_instruction: instruction,
                        confidence: analysis.confidence
                    });
                }
            }
        }, 150); // Slightly faster analysis for better responsiveness
    }
    
    generateSmartInstruction(analysis) {
        const distance = analysis.distance;
        const direction = analysis.direction;
        const confidence = analysis.confidence || 0.5;
        
        // Multi-level warning system
        if (distance < this.sensitivity * 0.6) {
            // Critical zone - immediate action needed
            if (confidence > 0.7) {
                return `STOP! Turn ${direction} immediately!`;
            } else {
                return `Caution! Obstacle detected - turn ${direction}`;
            }
        } else if (distance < this.sensitivity) {
            // Warning zone - prepare to turn
            if (direction === 'straight') {
                return 'Obstacle ahead - slow down and prepare to navigate';
            } else {
                return `Obstacle ahead - prepare to turn ${direction}`;
            }
        } else if (distance < this.sensitivity * 1.5) {
            // Caution zone - awareness
            return `Caution - obstacle at ${Math.round(distance)}cm ahead`;
        } else {
            // Safe zone
            if (direction === 'straight') {
                return 'Path is clear - safe to continue straight';
            } else {
                return 'Path is clear - continue forward';
            }
        }
    }

    stopAnalysisLoop() {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
    }

    updateNavigationDisplay(data) {
        // Update distance with confidence indicator
        this.distanceValue.textContent = data.distance;
        
        // Enhanced distance color coding with more levels
        if (data.distance < this.sensitivity * 0.6) {
            this.distanceValue.className = 'distance-value danger';
            this.instructionCard.style.backgroundColor = '#fed7d7';
            this.instructionIcon.textContent = '🚨';
        } else if (data.distance < this.sensitivity) {
            this.distanceValue.className = 'distance-value danger';
            this.instructionCard.style.backgroundColor = '#fed7d7';
            this.instructionIcon.textContent = '⚠️';
        } else if (data.distance < this.sensitivity * 1.5) {
            this.distanceValue.className = 'distance-value warning';
            this.instructionCard.style.backgroundColor = '#fef5e7';
            this.instructionIcon.textContent = '⚡';
        } else {
            this.distanceValue.className = 'distance-value';
            this.instructionCard.style.backgroundColor = '#f0fff4';
            this.instructionIcon.textContent = '✅';
        }

        // Update instruction with enhanced feedback
        this.instructionText.textContent = data.last_instruction;
        
        // Enhanced alert handling
        if (data.obstacle_detected) {
            this.instructionText.classList.add('alert');
            
            // More aggressive vibration for critical zones
            if (data.distance < this.sensitivity * 0.6) {
                if (navigator.vibrate) {
                    navigator.vibrate([300, 150, 300, 150, 300]);
                }
                
                // Critical voice alert
                if (this.voiceEnabled && (!this.lastCriticalAlert || Date.now() - this.lastCriticalAlert > 2000)) {
                    this.speak(data.last_instruction);
                    this.lastCriticalAlert = Date.now();
                }
            } else {
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }
                
                // Regular voice alert
                if (this.voiceEnabled && (!this.lastVoiceAlert || Date.now() - this.lastVoiceAlert > 3000)) {
                    this.speak(data.last_instruction);
                    this.lastVoiceAlert = Date.now();
                }
            }
        } else {
            this.instructionText.classList.remove('alert');
        }
        
        // Show confidence level for debugging (optional)
        if (data.confidence !== undefined) {
            const confidenceText = `${Math.round(data.confidence * 100)}% confident`;
            // You can display this somewhere if needed for debugging
        }
    }

    speak(text) {
        if (!this.voiceEnabled || !('speechSynthesis' in window)) return;

        // Cancel any ongoing speech
        speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.volume = 0.8;
        utterance.pitch = 1.0;
        
        speechSynthesis.speak(utterance);
    }

    setStatus(status, text) {
        this.statusDot.className = `status-dot ${status}`;
        this.statusText.textContent = text;
    }

    updateControlStates() {
        this.startBtn.disabled = this.isNavigationRunning || !this.cameraStream;
        this.stopBtn.disabled = !this.isNavigationRunning;
        this.cameraBtn.disabled = this.isNavigationRunning;
    }

    showAlert(message, type = 'info') {
        this.alertMessage.textContent = message;
        this.alertMessage.className = `alert-message show ${type === 'success' ? 'success' : ''}`;
        
        setTimeout(() => {
            this.alertMessage.classList.remove('show');
        }, 3000);
    }
}

// Global functions
function toggleCamera() {
    window.mobileApp?.toggleCamera();
}

function startNavigation() {
    window.mobileApp?.startNavigation();
}

function stopNavigation() {
    window.mobileApp?.stopNavigation();
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.mobileApp = new MobileNavigationApp();
    
    // Request screen wake lock if supported
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').catch(err => {
            console.log('Wake lock not available:', err);
        });
    }
});