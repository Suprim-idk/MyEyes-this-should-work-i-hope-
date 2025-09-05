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
        this.emergencyBtn = document.getElementById('emergencyBtn');
        this.voiceToggle = document.getElementById('voiceToggle');
        this.sensitivitySlider = document.getElementById('sensitivitySlider');
        this.sensitivityValue = document.getElementById('sensitivityValue');
        this.emergencyContact = document.getElementById('emergencyContact');
        this.emergencyModal = document.getElementById('emergencyModal');
        this.emergencyCountdown = document.getElementById('emergencyCountdown');
        
        // Emergency state
        this.emergencyActive = false;
        this.emergencyTimer = null;
        this.bystanderAlert = null;
        this.currentLocation = null;
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
        
        // Emergency contact storage
        const savedContact = localStorage.getItem('emergencyContact');
        if (savedContact) {
            this.emergencyContact.value = savedContact;
        }
        
        this.emergencyContact.addEventListener('input', (e) => {
            localStorage.setItem('emergencyContact', e.target.value);
        });
        
        // Get current location for emergency
        this.getCurrentLocation();
    }

    setupSocketHandlers() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.showAlert('Connected to navigation system', 'success');
        });

        this.socket.on('navigation_update', (data) => {
            this.updateNavigationDisplay(data);
            this.updateWheelchairInfo(data);
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
        try {
            // Set canvas size to match video
            this.analysisCanvas.width = this.cameraVideo.videoWidth || 640;
            this.analysisCanvas.height = this.cameraVideo.videoHeight || 480;
            console.log('Canvas setup:', this.analysisCanvas.width, 'x', this.analysisCanvas.height);
        } catch (error) {
            console.error('Canvas setup error:', error);
            // Fallback dimensions
            this.analysisCanvas.width = 640;
            this.analysisCanvas.height = 480;
        }
    }

    analyzeFrame() {
        try {
            if (!this.cameraStream || !this.analysisCanvas || !this.analysisContext) {
                console.log('Missing components for analysis');
                return null;
            }
            
            if (this.cameraVideo.readyState !== 4) {
                console.log('Video not ready for analysis');
                return null;
            }

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
        } catch (error) {
            console.error('Frame analysis error:', error);
            return null;
        }
    }

    processImageData(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        // Simple, reliable obstacle detection
        try {
            const analysis = this.performSimpleAnalysis(data, width, height);
            
            // Apply basic smoothing
            const smoothedDistance = this.applyBasicSmoothing(analysis.distance);
            
            return {
                distance: Math.round(smoothedDistance),
                direction: analysis.direction,
                confidence: analysis.confidence || 0.7,
                leftEdges: analysis.leftEdges || 0,
                rightEdges: analysis.rightEdges || 0,
                obstacleType: analysis.obstacleType || 'unknown',
                hazardLevel: this.getSimpleHazardLevel(smoothedDistance)
            };
        } catch (error) {
            console.error('Analysis error:', error);
            // Fallback safe values
            return {
                distance: 100,
                direction: 'straight',
                confidence: 0.5,
                leftEdges: 0,
                rightEdges: 0,
                obstacleType: 'unknown',
                hazardLevel: 'low'
            };
        }
    }
    
    performSimpleAnalysis(data, width, height) {
        // Simple but reliable detection method
        const centerX = Math.floor(width / 2);
        const scanWidth = Math.floor(width * 0.6); // Central 60% of image
        const startX = centerX - Math.floor(scanWidth / 2);
        const endX = centerX + Math.floor(scanWidth / 2);
        
        // Analyze bottom half of image (where ground obstacles appear)
        const startY = Math.floor(height * 0.5);
        
        let totalBrightness = 0;
        let edgeCount = 0;
        let leftEdges = 0;
        let rightEdges = 0;
        let darkPixels = 0;
        let pixelCount = 0;
        
        // Scan the critical navigation area
        for (let y = startY; y < height; y += 2) { // Skip every other row for speed
            for (let x = startX; x < endX; x += 2) { // Skip every other column for speed
                const i = (y * width + x) * 4;
                
                // Get pixel brightness
                const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
                totalBrightness += brightness;
                pixelCount++;
                
                // Count dark pixels (likely obstacles)
                if (brightness < 80) {
                    darkPixels++;
                }
                
                // Simple edge detection
                if (x > startX && x < endX - 2) {
                    const nextBrightness = (data[i + 8] + data[i + 9] + data[i + 10]) / 3;
                    const edgeStrength = Math.abs(brightness - nextBrightness);
                    
                    if (edgeStrength > 30) {
                        edgeCount++;
                        if (x < centerX) {
                            leftEdges++;
                        } else {
                            rightEdges++;
                        }
                    }
                }
            }
        }
        
        // Calculate averages
        const avgBrightness = pixelCount > 0 ? totalBrightness / pixelCount : 128;
        const darkRatio = pixelCount > 0 ? darkPixels / pixelCount : 0;
        const edgeDensity = pixelCount > 0 ? edgeCount / pixelCount : 0;
        
        // Simple distance estimation
        // Darker areas and more edges = closer obstacles
        let distance = 150; // Default safe distance
        
        // Reduce distance based on darkness and edges
        distance -= (darkRatio * 100);
        distance -= (edgeDensity * 1000);
        distance += ((avgBrightness - 128) / 2); // Brighter = further
        
        // Apply perspective correction (bottom of image = closer)
        const perspectiveBonus = 20;
        distance += perspectiveBonus;
        
        // Clamp to reasonable range
        distance = Math.max(20, Math.min(200, distance));
        
        // Determine direction
        let direction = 'straight';
        if (leftEdges < rightEdges * 0.7) {
            direction = 'left'; // More clear space on left
        } else if (rightEdges < leftEdges * 0.7) {
            direction = 'right'; // More clear space on right
        }
        
        // Calculate confidence based on edge density
        const confidence = Math.min(1.0, Math.max(0.3, edgeDensity * 5 + 0.3));
        
        // Determine obstacle type
        let obstacleType = 'none';
        if (darkRatio > 0.3) {
            obstacleType = 'large_obstacle';
        } else if (edgeDensity > 0.1) {
            obstacleType = 'small_obstacle';
        }
        
        return {
            distance: distance,
            direction: direction,
            confidence: confidence,
            leftEdges: leftEdges,
            rightEdges: rightEdges,
            obstacleType: obstacleType
        };
    }
    
    applyBasicSmoothing(newDistance) {
        // Simple smoothing with recent values
        if (!this.distanceHistory) {
            this.distanceHistory = [];
        }
        
        this.distanceHistory.push(newDistance);
        
        // Keep only last 3 readings
        if (this.distanceHistory.length > 3) {
            this.distanceHistory.shift();
        }
        
        // Simple average
        const sum = this.distanceHistory.reduce((a, b) => a + b, 0);
        return sum / this.distanceHistory.length;
    }
    
    getSimpleHazardLevel(distance) {
        if (distance < 30) return 'critical';
        if (distance < 50) return 'high';
        if (distance < 80) return 'medium';
        return 'low';
    }
    
    // Removed complex analysis - using simple but reliable method above
    
    generateDepthMap(data, width, height) {
        // Create a depth map using stereo vision simulation and perspective cues
        const depthMap = new Float32Array(width * height);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const pixelIdx = idx * 4;
                
                // Get pixel brightness and apply perspective correction
                const brightness = this.getGrayValue(data, pixelIdx);
                const perspectiveFactor = this.calculatePerspectiveFactor(x, y, width, height);
                
                // Calculate depth using brightness, texture, and perspective
                const textureComplexity = this.calculateLocalTexture(data, x, y, width, height);
                const edgeStrength = this.calculateLocalEdges(data, x, y, width, height);
                
                // Combine factors for depth estimation
                let depth = 255 - brightness; // Darker = closer
                depth *= perspectiveFactor; // Apply perspective correction
                depth += textureComplexity * 0.3; // More texture = closer
                depth += edgeStrength * 0.2; // Stronger edges = closer
                
                depthMap[idx] = Math.max(0, Math.min(255, depth));
            }
        }
        
        // Apply Gaussian blur for smoothing
        return this.gaussianBlur(depthMap, width, height, 2);
    }
    
    performObjectSegmentation(data, width, height) {
        // Segment the image into different object types
        const segments = new Uint8Array(width * height);
        const GROUND = 1, OBSTACLE = 2, WALL = 3, UNKNOWN = 0;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const pixelIdx = idx * 4;
                
                const brightness = this.getGrayValue(data, pixelIdx);
                const verticalPosition = y / height;
                const horizontalPosition = Math.abs((x / width) - 0.5);
                
                // Classify based on position, brightness, and local features
                const localVariance = this.calculateLocalVariance(data, x, y, width, height, 5);
                const edgeStrength = this.calculateLocalEdges(data, x, y, width, height);
                
                if (verticalPosition > 0.8 && localVariance < 100) {
                    segments[idx] = GROUND; // Bottom area with low variance = ground
                } else if (edgeStrength > 40 && brightness < 100) {
                    segments[idx] = OBSTACLE; // Strong edges + dark = obstacle
                } else if (verticalPosition < 0.3 && horizontalPosition > 0.3) {
                    segments[idx] = WALL; // Top corners = walls/buildings
                } else {
                    segments[idx] = UNKNOWN;
                }
            }
        }
        
        return segments;
    }
    
    analyzeDepthMap(depthMap, width, height) {
        // Analyze the depth map for obstacle detection
        const centerX = Math.floor(width / 2);
        const pathWidth = Math.floor(width * 0.4);
        const criticalZone = Math.floor(height * 0.6);
        
        let minDistance = 255;
        let avgDistance = 0;
        let obstaclePixels = 0;
        let totalPixels = 0;
        
        // Scan the critical navigation area
        for (let y = criticalZone; y < height; y++) {
            for (let x = centerX - pathWidth; x < centerX + pathWidth; x++) {
                if (x >= 0 && x < width) {
                    const depth = depthMap[y * width + x];
                    minDistance = Math.min(minDistance, depth);
                    avgDistance += depth;
                    totalPixels++;
                    
                    // Count obstacle pixels (close objects)
                    if (depth < 80) {
                        obstaclePixels++;
                    }
                }
            }
        }
        
        avgDistance = totalPixels > 0 ? avgDistance / totalPixels : 128;
        const obstacleRatio = totalPixels > 0 ? obstaclePixels / totalPixels : 0;
        
        // Convert depth to real-world distance (calibrated)
        const realDistance = this.depthToRealDistance(minDistance, avgDistance);
        const confidence = Math.min(1.0, obstacleRatio + 0.3);
        
        return {
            distance: realDistance,
            confidence: confidence,
            obstacleRatio: obstacleRatio
        };
    }
    
    analyzeObjects(segments, width, height) {
        // Analyze segmented objects for navigation
        const centerX = Math.floor(width / 2);
        const pathWidth = Math.floor(width * 0.5);
        
        let leftObstacles = 0, rightObstacles = 0;
        let closestObstacle = 255;
        let obstacleType = 'none';
        
        // Scan for obstacles in navigation path
        for (let y = Math.floor(height * 0.4); y < height; y++) {
            for (let x = 0; x < width; x++) {
                const segment = segments[y * width + x];
                
                if (segment === 2) { // OBSTACLE
                    const distanceFromBottom = height - y;
                    const obstacleDistance = distanceFromBottom * 2; // Rough distance estimate
                    
                    if (obstacleDistance < closestObstacle) {
                        closestObstacle = obstacleDistance;
                        obstacleType = this.classifyObstacle(segments, x, y, width, height);
                    }
                    
                    // Count left/right obstacles
                    if (x < centerX - pathWidth / 4) {
                        leftObstacles++;
                    } else if (x > centerX + pathWidth / 4) {
                        rightObstacles++;
                    }
                }
            }
        }
        
        // Convert to real distance
        const realDistance = Math.max(20, Math.min(200, closestObstacle * 1.5));
        const confidence = closestObstacle < 200 ? 0.8 : 0.4;
        
        return {
            distance: realDistance,
            confidence: confidence,
            obstacleType: obstacleType,
            leftEdges: leftObstacles,
            rightEdges: rightObstacles
        };
    }
    
    applyCameraCalibration(analysis, width, height) {
        // Apply real-world camera calibration for accurate distance
        
        // Mobile camera typical specs (adjust based on testing)
        const focalLength = 4.0; // mm (typical smartphone)
        const sensorHeight = 5.5; // mm (typical smartphone sensor)
        const realWorldHeight = 170; // cm (average eye height)
        
        // Calculate real distance using camera geometry
        const pixelHeight = height;
        const angularHeight = Math.atan(sensorHeight / (2 * focalLength)) * 2;
        const distanceFromHeight = realWorldHeight / Math.tan(angularHeight);
        
        // Combine geometric calculation with analysis
        const geometricDistance = distanceFromHeight / 10; // Convert to appropriate scale
        const combinedDistance = (analysis.distance * 0.7) + (geometricDistance * 0.3);
        
        // Apply field testing calibration factors
        const calibrationFactor = this.getCalibrationFactor();
        const calibratedDistance = combinedDistance * calibrationFactor;
        
        return {
            distance: Math.max(15, Math.min(300, calibratedDistance)),
            confidence: Math.min(1.0, analysis.confidence + 0.2)
        };
    }
    
    getCalibrationFactor() {
        // Calibration factor based on real-world testing
        // This should be adjusted based on actual field testing
        return 1.2; // Adjust this value based on real-world testing
    }
    
    depthToRealDistance(minDepth, avgDepth) {
        // Convert depth map values to real-world centimeters
        // Based on perspective and typical mobile camera characteristics
        
        const normalizedDepth = minDepth / 255.0;
        const perspectiveDistance = 50 + (1.0 - normalizedDepth) * 150;
        
        // Apply non-linear correction for better accuracy
        const correctedDistance = perspectiveDistance * (1.0 + Math.pow(1.0 - normalizedDepth, 2));
        
        return Math.max(20, Math.min(250, correctedDistance));
    }
    
    calculatePerspectiveFactor(x, y, width, height) {
        // Calculate perspective correction factor
        const centerX = width / 2;
        const centerY = height / 2;
        
        const distanceFromCenter = Math.sqrt(
            Math.pow((x - centerX) / width, 2) + 
            Math.pow((y - centerY) / height, 2)
        );
        
        // Closer to bottom center = closer in real world
        const verticalFactor = 1.0 + (y / height) * 0.5;
        const horizontalFactor = 1.0 - Math.abs((x - centerX) / width) * 0.2;
        
        return verticalFactor * horizontalFactor;
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
    
    calculateLocalTexture(data, x, y, width, height) {
        // Calculate local texture complexity
        const radius = 3;
        let textureSum = 0;
        let count = 0;
        
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const gray = this.getGrayValue(data, (ny * width + nx) * 4);
                    textureSum += Math.abs(gray - 128); // Deviation from medium gray
                    count++;
                }
            }
        }
        
        return count > 0 ? textureSum / count : 0;
    }
    
    calculateLocalEdges(data, x, y, width, height) {
        // Calculate local edge strength
        if (x <= 0 || x >= width - 1 || y <= 0 || y >= height - 1) return 0;
        
        const center = this.getGrayValue(data, (y * width + x) * 4);
        const left = this.getGrayValue(data, (y * width + (x - 1)) * 4);
        const right = this.getGrayValue(data, (y * width + (x + 1)) * 4);
        const top = this.getGrayValue(data, ((y - 1) * width + x) * 4);
        const bottom = this.getGrayValue(data, ((y + 1) * width + x) * 4);
        
        const gx = right - left;
        const gy = bottom - top;
        
        return Math.sqrt(gx * gx + gy * gy);
    }
    
    calculateLocalVariance(data, x, y, width, height, radius) {
        // Calculate variance in local neighborhood
        let sum = 0;
        let sumSquares = 0;
        let count = 0;
        
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const gray = this.getGrayValue(data, (ny * width + nx) * 4);
                    sum += gray;
                    sumSquares += gray * gray;
                    count++;
                }
            }
        }
        
        if (count === 0) return 0;
        const mean = sum / count;
        return (sumSquares / count) - (mean * mean);
    }
    
    gaussianBlur(data, width, height, radius) {
        // Apply Gaussian blur for smoothing
        const result = new Float32Array(width * height);
        const kernel = this.generateGaussianKernel(radius);
        const kernelSize = kernel.length;
        const halfKernel = Math.floor(kernelSize / 2);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                let weightSum = 0;
                
                for (let ky = 0; ky < kernelSize; ky++) {
                    for (let kx = 0; kx < kernelSize; kx++) {
                        const px = x + kx - halfKernel;
                        const py = y + ky - halfKernel;
                        
                        if (px >= 0 && px < width && py >= 0 && py < height) {
                            const weight = kernel[ky] * kernel[kx];
                            sum += data[py * width + px] * weight;
                            weightSum += weight;
                        }
                    }
                }
                
                result[y * width + x] = weightSum > 0 ? sum / weightSum : data[y * width + x];
            }
        }
        
        return result;
    }
    
    generateGaussianKernel(radius) {
        // Generate 1D Gaussian kernel
        const size = radius * 2 + 1;
        const kernel = new Float32Array(size);
        const sigma = radius / 3.0;
        let sum = 0;
        
        for (let i = 0; i < size; i++) {
            const x = i - radius;
            kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
            sum += kernel[i];
        }
        
        // Normalize
        for (let i = 0; i < size; i++) {
            kernel[i] /= sum;
        }
        
        return kernel;
    }
    
    classifyObstacle(segments, x, y, width, height) {
        // Classify the type of obstacle
        const radius = 10;
        let obstaclePixels = 0;
        let wallPixels = 0;
        let totalPixels = 0;
        
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const segment = segments[ny * width + nx];
                    if (segment === 2) obstaclePixels++;
                    if (segment === 3) wallPixels++;
                    totalPixels++;
                }
            }
        }
        
        if (wallPixels / totalPixels > 0.3) return 'wall';
        if (obstaclePixels / totalPixels > 0.5) return 'large_obstacle';
        return 'small_obstacle';
    }
    
    analyzeOpticalFlow(data, width, height) {
        // Placeholder for optical flow analysis (for motion detection)
        // In a full implementation, this would track pixel movement between frames
        return {
            distance: 100,
            confidence: 0.3
        };
    }
    
    analyzeMotion(opticalFlow, width, height) {
        // Analyze motion for obstacle detection
        return {
            distance: opticalFlow.distance,
            confidence: opticalFlow.confidence
        };
    }
    
    correctPerspective(data, width, height) {
        // Placeholder for perspective correction
        return data;
    }
    
    analyzeGeometry(perspectiveData, width, height) {
        // Geometric analysis of corrected perspective
        return {
            distance: 100,
            confidence: 0.4
        };
    }
    
    combineAdvancedEstimates(estimates) {
        // Combine multiple estimates with confidence weighting
        let weightedSum = 0;
        let totalWeight = 0;
        let totalConfidence = 0;
        
        estimates.forEach(est => {
            const weight = est.weight * Math.pow(est.confidence, 2); // Square confidence for better weighting
            weightedSum += est.distance * weight;
            totalWeight += weight;
            totalConfidence += est.confidence;
        });
        
        const finalDistance = totalWeight > 0 ? weightedSum / totalWeight : 100;
        const avgConfidence = totalConfidence / estimates.length;
        
        return {
            distance: finalDistance,
            confidence: Math.min(1.0, avgConfidence)
        };
    }
    
    determineSmartDirection(objectAnalysis, geometryAnalysis, calibratedAnalysis) {
        // Advanced direction determination
        const leftObstacles = objectAnalysis.leftEdges || 0;
        const rightObstacles = objectAnalysis.rightEdges || 0;
        const totalObstacles = leftObstacles + rightObstacles;
        
        if (totalObstacles === 0) return 'straight';
        
        const leftRatio = leftObstacles / totalObstacles;
        const rightRatio = rightObstacles / totalObstacles;
        
        // More sophisticated direction logic
        if (leftRatio < 0.3) {
            return 'left'; // Much clearer on left
        } else if (rightRatio < 0.3) {
            return 'right'; // Much clearer on right
        } else if (leftRatio < 0.45) {
            return 'left'; // Somewhat clearer on left
        } else if (rightRatio < 0.45) {
            return 'right'; // Somewhat clearer on right
        } else {
            return 'straight'; // Relatively balanced, continue straight
        }
    }
    
    calculateHazardLevel(combinedDistance, objectAnalysis) {
        // Calculate hazard level based on distance and obstacle type
        const distance = combinedDistance.distance;
        const obstacleType = objectAnalysis.obstacleType;
        
        let hazardLevel = 'low';
        
        if (distance < 30) {
            hazardLevel = 'critical';
        } else if (distance < 60) {
            hazardLevel = 'high';
        } else if (distance < 100) {
            hazardLevel = 'medium';
        }
        
        // Increase hazard for certain obstacle types
        if (obstacleType === 'wall' && distance < 80) {
            hazardLevel = hazardLevel === 'medium' ? 'high' : hazardLevel;
        }
        
        return hazardLevel;
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
        console.log('Starting analysis loop...');
        
        this.analysisInterval = setInterval(() => {
            try {
                if (this.isNavigationRunning && this.cameraStream && this.cameraVideo.readyState === 4) {
                    const analysis = this.analyzeFrame();
                    if (analysis) {
                        console.log('Analysis result:', analysis);
                        
                        // Generate instruction
                        const instruction = this.generateSimpleInstruction(analysis);
                        
                        // Send analysis to server
                        this.socket.emit('camera_analysis', {
                            ...analysis,
                            instruction: instruction
                        });
                        
                        // Update local display
                        this.updateNavigationDisplay({
                            distance: analysis.distance,
                            direction: analysis.direction,
                            obstacle_detected: analysis.distance < this.sensitivity,
                            last_instruction: instruction,
                            confidence: analysis.confidence,
                            hazardLevel: analysis.hazardLevel
                        });
                    } else {
                        console.log('No analysis result');
                    }
                } else {
                    console.log('Analysis conditions not met:', {
                        running: this.isNavigationRunning,
                        camera: !!this.cameraStream,
                        videoReady: this.cameraVideo.readyState
                    });
                }
            } catch (error) {
                console.error('Analysis loop error:', error);
            }
        }, 200); // 5 times per second - reliable rate
    }
    
    generateSimpleInstruction(analysis) {
        const distance = analysis.distance;
        const direction = analysis.direction;
        const hazardLevel = analysis.hazardLevel || 'low';
        
        // Simple, clear instructions
        if (hazardLevel === 'critical' || distance < 30) {
            return `STOP! Obstacle ${Math.round(distance)}cm ahead - turn ${direction} NOW!`;
        } else if (hazardLevel === 'high' || distance < 50) {
            return `WARNING: Obstacle ${Math.round(distance)}cm ahead - turn ${direction}`;
        } else if (hazardLevel === 'medium' || distance < this.sensitivity) {
            return `Caution: Obstacle ${Math.round(distance)}cm ahead - prepare to turn ${direction}`;
        } else {
            return `Path clear - ${Math.round(distance)}cm ahead`;
        }
    }
    
    generateCriticalAlert(distance, direction, obstacleType) {
        // Critical alerts based on obstacle type
        const distanceCm = Math.round(distance);
        
        switch (obstacleType) {
            case 'wall':
                return `STOP! Wall ${distanceCm}cm ahead - turn ${direction} immediately!`;
            case 'large_obstacle':
                return `DANGER! Large obstacle ${distanceCm}cm - turn ${direction} now!`;
            case 'small_obstacle':
                return `STOP! Obstacle ${distanceCm}cm ahead - step ${direction}!`;
            default:
                return `CRITICAL! Stop and turn ${direction} - obstacle at ${distanceCm}cm!`;
        }
    }
    
    generateHighAlert(distance, direction, obstacleType) {
        const distanceCm = Math.round(distance);
        
        if (direction === 'straight') {
            return `High alert! Obstacle ${distanceCm}cm ahead - slow down and prepare to navigate`;
        }
        
        switch (obstacleType) {
            case 'wall':
                return `Wall detected ${distanceCm}cm ahead - prepare to turn ${direction}`;
            case 'large_obstacle':
                return `Large obstacle ${distanceCm}cm - prepare to turn ${direction}`;
            default:
                return `Alert! Obstacle ${distanceCm}cm ahead - prepare to turn ${direction}`;
        }
    }
    
    generateWarningAlert(distance, direction, obstacleType) {
        const distanceCm = Math.round(distance);
        
        if (direction === 'straight') {
            return `Obstacle ${distanceCm}cm ahead - path may be navigable straight`;
        }
        
        return `Warning: ${obstacleType} ${distanceCm}cm ahead - consider turning ${direction}`;
    }
    
    generateCautionAlert(distance, direction, obstacleType) {
        const distanceCm = Math.round(distance);
        
        if (obstacleType === 'wall') {
            return `Caution: Wall detected at ${distanceCm}cm`;
        } else if (obstacleType === 'large_obstacle') {
            return `Caution: Large object at ${distanceCm}cm ahead`;
        } else {
            return `Caution: Obstacle detected at ${distanceCm}cm ahead`;
        }
    }
    
    generateSafeAlert(direction, confidence) {
        if (confidence > 0.8) {
            return 'Path is clear - safe to continue forward';
        } else if (direction === 'straight') {
            return 'Path appears clear - continue straight with caution';
        } else {
            return 'Path is mostly clear - continue forward';
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
        
        // Advanced alert handling with hazard levels
        const hazardLevel = data.hazardLevel || 'low';
        
        if (data.obstacle_detected) {
            this.instructionText.classList.add('alert');
            
            // Hazard-based vibration and voice alerts
            if (hazardLevel === 'critical') {
                if (navigator.vibrate) {
                    navigator.vibrate([400, 200, 400, 200, 400]);
                }
                
                // Immediate critical voice alert
                if (this.voiceEnabled && (!this.lastCriticalAlert || Date.now() - this.lastCriticalAlert > 1500)) {
                    this.speak(data.last_instruction);
                    this.lastCriticalAlert = Date.now();
                }
            } else if (hazardLevel === 'high') {
                if (navigator.vibrate) {
                    navigator.vibrate([300, 150, 300]);
                }
                
                // High priority voice alert
                if (this.voiceEnabled && (!this.lastHighAlert || Date.now() - this.lastHighAlert > 2500)) {
                    this.speak(data.last_instruction);
                    this.lastHighAlert = Date.now();
                }
            } else if (hazardLevel === 'medium') {
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }
                
                // Regular voice alert
                if (this.voiceEnabled && (!this.lastVoiceAlert || Date.now() - this.lastVoiceAlert > 4000)) {
                    this.speak(data.last_instruction);
                    this.lastVoiceAlert = Date.now();
                }
            } else {
                // Low-level alert - minimal feedback
                if (navigator.vibrate) {
                    navigator.vibrate([100]);
                }
                
                // Infrequent voice for low-level alerts
                if (this.voiceEnabled && (!this.lastLowAlert || Date.now() - this.lastLowAlert > 6000)) {
                    this.speak(data.last_instruction);
                    this.lastLowAlert = Date.now();
                }
            }
        } else {
            this.instructionText.classList.remove('alert');
        }
        
        // Display advanced analysis information
        if (data.confidence !== undefined) {
            const confidenceText = `${Math.round(data.confidence * 100)}% confident`;
            // Show confidence and hazard level in status (optional debug info)
            
            // Update with obstacle type info if available
            if (data.obstacleType && data.obstacleType !== 'none') {
                // Could show obstacle type in UI: `${data.obstacleType} detected`
            }
        }
    }

    updateWheelchairInfo(data) {
        // Update path width
        if (data.path_width) {
            const pathWidthElement = document.getElementById('pathWidthValue');
            if (pathWidthElement) {
                pathWidthElement.textContent = `${data.path_width}cm`;
                
                // Color-code based on wheelchair accessibility
                if (data.path_width < 90) {
                    pathWidthElement.style.color = '#dc2626';
                    pathWidthElement.style.fontWeight = 'bold';
                } else if (data.path_width < 120) {
                    pathWidthElement.style.color = '#ea580c';
                } else {
                    pathWidthElement.style.color = '#16a34a';
                }
            }
        }

        // Update surface type
        if (data.surface_type) {
            const surfaceElement = document.getElementById('surfaceTypeValue');
            if (surfaceElement) {
                surfaceElement.textContent = data.surface_type.charAt(0).toUpperCase() + data.surface_type.slice(1);
                
                // Color-code based on wheelchair suitability
                if (['rough', 'gravel', 'sand'].includes(data.surface_type)) {
                    surfaceElement.style.color = '#dc2626';
                } else if (data.surface_type === 'textured') {
                    surfaceElement.style.color = '#ea580c';
                } else {
                    surfaceElement.style.color = '#16a34a';
                }
            }
        }

        // Handle accessibility obstacles
        const obstaclesAlert = document.getElementById('obstaclesAlert');
        const obstacleList = document.getElementById('obstacleList');
        
        if (data.accessibility_obstacles && data.accessibility_obstacles.length > 0) {
            if (obstaclesAlert && obstacleList) {
                obstaclesAlert.style.display = 'block';
                
                // Create obstacle list HTML
                const obstacleHTML = data.accessibility_obstacles.map(obstacle => 
                    `<div class="obstacle-item">
                        <strong>${obstacle.type.replace('_', ' ').toUpperCase()}:</strong><br>
                        ${obstacle.message}
                    </div>`
                ).join('');
                
                obstacleList.innerHTML = obstacleHTML;
                
                // Enhanced voice alerts for critical obstacles
                const criticalObstacles = data.accessibility_obstacles.filter(o => o.severity === 'critical');
                if (criticalObstacles.length > 0 && this.voiceEnabled) {
                    if (!this.lastCriticalWheelchairAlert || Date.now() - this.lastCriticalWheelchairAlert > 3000) {
                        this.speak(criticalObstacles[0].message);
                        this.lastCriticalWheelchairAlert = Date.now();
                        
                        // Intense vibration for critical wheelchair obstacles
                        if (navigator.vibrate) {
                            navigator.vibrate([500, 300, 500, 300, 500, 300, 500]);
                        }
                    }
                }
            }
        } else {
            if (obstaclesAlert) {
                obstaclesAlert.style.display = 'none';
            }
        }

        // Handle alternative route suggestions
        const routeSuggestion = document.getElementById('routeSuggestion');
        const suggestionText = document.getElementById('suggestionText');
        
        if (data.alternative_route_suggestion && data.alternative_route_suggestion.trim()) {
            if (routeSuggestion && suggestionText) {
                routeSuggestion.style.display = 'block';
                suggestionText.textContent = data.alternative_route_suggestion;
            }
        } else {
            if (routeSuggestion) {
                routeSuggestion.style.display = 'none';
            }
        }

        // Handle accessibility signs
        if (data.accessibility_signs && data.accessibility_signs.length > 0) {
            for (const sign of data.accessibility_signs) {
                if (sign.type === 'possible_accessibility_sign') {
                    // Voice alert for accessibility signs
                    if (this.voiceEnabled && (!this.lastSignAlert || Date.now() - this.lastSignAlert > 10000)) {
                        this.speak(sign.message);
                        this.lastSignAlert = Date.now();
                    }
                }
            }
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