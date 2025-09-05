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

        // Convert to grayscale and detect edges
        let leftEdges = 0, rightEdges = 0;
        let totalPixels = 0;

        for (let y = Math.floor(height * 0.3); y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
                
                // Simple edge detection
                if (x > 0 && x < width - 1) {
                    const prevGray = (data[i - 4] + data[i - 3] + data[i - 2]) / 3;
                    const nextGray = (data[i + 4] + data[i + 5] + data[i + 6]) / 3;
                    const edge = Math.abs(prevGray - nextGray);
                    
                    if (edge > 30) { // Edge threshold
                        if (x < width / 2) {
                            leftEdges++;
                        } else {
                            rightEdges++;
                        }
                    }
                }
                totalPixels++;
            }
        }

        // Calculate distance estimate based on bottom portion detail
        const bottomY = Math.floor(height * 0.8);
        let bottomDetail = 0;
        let bottomPixels = 0;

        for (let y = bottomY; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
                bottomDetail += gray;
                bottomPixels++;
            }
        }

        const avgDetail = bottomPixels > 0 ? bottomDetail / bottomPixels : 128;
        const distance = Math.max(20, Math.min(200, (255 - avgDetail) * 2 + 30));

        return {
            distance: Math.round(distance),
            direction: leftEdges < rightEdges ? 'left' : 'right',
            leftEdges,
            rightEdges
        };
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
                    // Send analysis to server
                    this.socket.emit('camera_analysis', analysis);
                    
                    // Update local display immediately
                    this.updateNavigationDisplay({
                        distance: analysis.distance,
                        direction: analysis.direction,
                        obstacle_detected: analysis.distance < this.sensitivity,
                        last_instruction: analysis.distance < this.sensitivity ? 
                            `Turn ${analysis.direction} now!` : 'Path is clear'
                    });
                }
            }
        }, 200); // Analyze 5 times per second
    }

    stopAnalysisLoop() {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
    }

    updateNavigationDisplay(data) {
        // Update distance
        this.distanceValue.textContent = data.distance;
        
        // Update distance color
        if (data.distance < this.sensitivity) {
            this.distanceValue.className = 'distance-value danger';
        } else if (data.distance < this.sensitivity * 1.5) {
            this.distanceValue.className = 'distance-value warning';
        } else {
            this.distanceValue.className = 'distance-value';
        }

        // Update instruction
        this.instructionText.textContent = data.last_instruction;
        
        if (data.obstacle_detected) {
            this.instructionCard.style.backgroundColor = '#fed7d7';
            this.instructionText.classList.add('alert');
            this.instructionIcon.textContent = '⚠️';
            
            if (this.voiceEnabled) {
                this.speak(data.last_instruction);
            }
            
            // Vibrate if supported
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }
        } else {
            this.instructionCard.style.backgroundColor = 'white';
            this.instructionText.classList.remove('alert');
            this.instructionIcon.textContent = 'ℹ️';
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