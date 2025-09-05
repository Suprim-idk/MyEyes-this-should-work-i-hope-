// Navigation Assistant Frontend JavaScript

class NavigationInterface {
    constructor() {
        this.socket = io();
        this.isRunning = false;
        this.initializeElements();
        this.setupSocketHandlers();
        this.setupEventHandlers();
    }

    initializeElements() {
        this.statusLight = document.getElementById('statusLight');
        this.statusText = document.getElementById('statusText');
        this.distanceValue = document.getElementById('distanceValue');
        this.instructionText = document.getElementById('instructionText');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.alertBox = document.getElementById('alertBox');
        this.alertText = document.getElementById('alertText');
        
        // Camera elements
        this.cameraLight = document.getElementById('cameraLight');
        this.cameraStatusText = document.getElementById('cameraStatusText');
        this.phoneIP = document.getElementById('phoneIP');
        this.usbCameraId = document.getElementById('usbCameraId');
    }

    setupSocketHandlers() {
        this.socket.on('connect', () => {
            console.log('Connected to navigation system');
            this.showAlert('Connected to navigation system', 'clear');
        });

        this.socket.on('navigation_update', (data) => {
            this.updateDisplay(data);
        });

        this.socket.on('navigation_started', (data) => {
            this.isRunning = true;
            this.updateButtonStates();
            this.setStatus('running', 'Navigation Active');
            this.showAlert('Navigation started successfully', 'clear');
            this.speak('Navigation system started');
        });

        this.socket.on('navigation_stopped', (data) => {
            this.isRunning = false;
            this.updateButtonStates();
            this.setStatus('stopped', 'Navigation Stopped');
            this.showAlert('Navigation stopped', 'clear');
            this.speak('Navigation system stopped');
        });
        
        this.socket.on('camera_connected', (data) => {
            this.setCameraStatus('connected', data.message);
            this.showAlert(data.message, 'clear');
            this.speak('Camera connected successfully');
        });
        
        this.socket.on('camera_error', (data) => {
            this.setCameraStatus('error', data.message);
            this.showAlert(data.message, 'obstacle');
            this.speak('Camera connection failed');
        });
    }

    setupEventHandlers() {
        // Keyboard shortcuts for accessibility
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const activeElement = document.activeElement;
                if (activeElement.classList.contains('control-btn')) {
                    e.preventDefault();
                    activeElement.click();
                }
            }
            
            // Quick shortcuts
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (this.isRunning) {
                    this.stopNavigation();
                } else {
                    this.startNavigation();
                }
            }
        });
    }

    updateDisplay(data) {
        // Update distance display
        this.distanceValue.textContent = data.distance;
        
        // Update instruction
        this.instructionText.textContent = data.last_instruction;
        
        // Add visual feedback for obstacles
        if (data.obstacle_detected) {
            this.instructionText.classList.add('alert');
            this.showAlert(`Obstacle detected! ${data.last_instruction}`, 'obstacle');
            this.speak(data.last_instruction);
        } else {
            this.instructionText.classList.remove('alert');
        }
        
        // Update distance color based on proximity
        if (data.distance < 50) {
            this.distanceValue.style.color = '#e53e3e';
        } else if (data.distance < 100) {
            this.distanceValue.style.color = '#ed8936';
        } else {
            this.distanceValue.style.color = '#667eea';
        }
    }

    setStatus(status, text) {
        this.statusLight.className = `status-light ${status}`;
        this.statusText.textContent = text;
    }

    updateButtonStates() {
        this.startBtn.disabled = this.isRunning;
        this.stopBtn.disabled = !this.isRunning;
        
        if (this.isRunning) {
            this.startBtn.style.opacity = '0.5';
            this.stopBtn.style.opacity = '1';
        } else {
            this.startBtn.style.opacity = '1';
            this.stopBtn.style.opacity = '0.5';
        }
    }

    showAlert(message, type) {
        this.alertText.textContent = message;
        this.alertBox.className = `alert-box ${type}`;
        
        // Auto-hide after 3 seconds for non-critical alerts
        if (type !== 'obstacle') {
            setTimeout(() => {
                this.alertBox.classList.add('hidden');
            }, 3000);
        }
    }

    speak(text) {
        // Use Web Speech API for voice feedback
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.8; // Slower for clarity
            utterance.volume = 0.8;
            
            // Use a clear, neutral voice if available
            const voices = speechSynthesis.getVoices();
            const preferredVoice = voices.find(voice => 
                voice.lang.includes('en') && voice.name.includes('Google')
            ) || voices.find(voice => voice.lang.includes('en'));
            
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }
            
            speechSynthesis.speak(utterance);
        }
    }

    startNavigation() {
        this.socket.emit('start_navigation');
    }

    stopNavigation() {
        this.socket.emit('stop_navigation');
    }
    
    setCameraStatus(status, text) {
        this.cameraLight.className = `status-light ${status}`;
        this.cameraStatusText.textContent = text;
    }
    
    connectPhoneCamera() {
        const ip = this.phoneIP.value.trim();
        if (!ip) {
            this.showAlert('Please enter your phone IP address', 'obstacle');
            return;
        }
        
        this.setCameraStatus('connecting', 'Connecting to phone...');
        this.socket.emit('connect_phone_camera', { ip: ip });
    }
    
    connectUSBCamera() {
        const cameraId = parseInt(this.usbCameraId.value);
        this.setCameraStatus('connecting', 'Connecting to USB camera...');
        this.socket.emit('connect_usb_camera', { id: cameraId });
    }
}

// Global functions for button onclick handlers
function startNavigation() {
    if (window.navInterface) {
        window.navInterface.startNavigation();
    }
}

function stopNavigation() {
    if (window.navInterface) {
        window.navInterface.stopNavigation();
    }
}

function connectPhoneCamera() {
    if (window.navInterface) {
        window.navInterface.connectPhoneCamera();
    }
}

function connectUSBCamera() {
    if (window.navInterface) {
        window.navInterface.connectUSBCamera();
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.navInterface = new NavigationInterface();
    
    // Load voices for speech synthesis
    if ('speechSynthesis' in window) {
        speechSynthesis.getVoices();
        speechSynthesis.onvoiceschanged = () => {
            speechSynthesis.getVoices();
        };
    }
});