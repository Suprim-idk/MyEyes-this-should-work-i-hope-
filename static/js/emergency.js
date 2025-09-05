// Emergency Functions Extension for Mobile Navigation App

// Add emergency methods to MobileNavigationApp prototype
Object.assign(MobileNavigationApp.prototype, {
    
    getCurrentLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    console.log('Location obtained:', this.currentLocation);
                },
                (error) => {
                    console.warn('Location access denied:', error);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
            );
        }
    },
    
    triggerEmergency() {
        if (this.emergencyActive) return;
        
        this.emergencyActive = true;
        this.emergencyModal.style.display = 'flex';
        
        // Start countdown
        let countdown = 10;
        this.emergencyCountdown.textContent = countdown;
        
        this.emergencyTimer = setInterval(() => {
            countdown--;
            this.emergencyCountdown.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(this.emergencyTimer);
                this.executeEmergencyProtocol();
            }
        }, 1000);
        
        // Immediate actions
        this.getCurrentLocation();
        this.speak('Emergency activated. Help is being called.');
        
        // Vibrate intensely
        if (navigator.vibrate) {
            navigator.vibrate([1000, 500, 1000, 500, 1000]);
        }
        
        // Keep screen awake
        navigator.wakeLock?.request('screen');
    },
    
    executeEmergencyProtocol() {
        // Auto-execute all emergency actions
        this.callEmergency();
        this.shareLocation();
        this.alertBystanders();
        
        // Continue alerting
        this.continuousAlert();
    },
    
    callEmergency() {
        const emergencyNumber = this.emergencyContact.value || '100';
        
        if (emergencyNumber) {
            // Attempt to call
            const callLink = `tel:${emergencyNumber}`;
            window.location.href = callLink;
            
            this.speak(`Calling emergency contact: ${emergencyNumber}`);
            this.showAlert(`Calling ${emergencyNumber}...`, 'error');
        } else {
            this.speak('No emergency contact set. Please call 100 manually.');
            this.showAlert('No emergency contact configured!', 'error');
        }
    },
    
    shareLocation() {
        if (this.currentLocation) {
            const locationText = `Emergency! I need help. My location: https://maps.google.com/?q=${this.currentLocation.latitude},${this.currentLocation.longitude}`;
            
            // Try to share via Web Share API
            if (navigator.share) {
                navigator.share({
                    title: 'Emergency Location',
                    text: locationText,
                    url: `https://maps.google.com/?q=${this.currentLocation.latitude},${this.currentLocation.longitude}`
                }).catch(console.error);
            } else {
                // Fallback: copy to clipboard
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(locationText)
                        .then(() => this.showAlert('Location copied to clipboard!', 'success'))
                        .catch(console.error);
                }
            }
            
            this.speak('Location shared for emergency assistance.');
        } else {
            this.speak('Location not available. Requesting location access.');
            this.getCurrentLocation();
        }
    },
    
    alertBystanders() {
        // Create full-screen bystander alert
        this.bystanderAlert = document.createElement('div');
        this.bystanderAlert.className = 'bystander-alert';
        this.bystanderAlert.innerHTML = `
            <div>
                <h1>🚨 EMERGENCY 🚨</h1>
                <p>This person needs assistance!</p>
                <p>Please help or call for help!</p>
                <button onclick="window.mobileApp.closeBystanders()" style="padding: 15px 30px; font-size: 1.2rem; margin-top: 20px; border: none; border-radius: 10px; background: white; color: #d32f2f; font-weight: bold;">Close Alert</button>
            </div>
        `;
        
        document.body.appendChild(this.bystanderAlert);
        
        // Maximum volume alert sound
        this.speak('Emergency! This person needs assistance! Please help or call for help!');
        
        // Continuous vibration
        if (navigator.vibrate) {
            this.continuousVibration();
        }
    },
    
    continuousAlert() {
        // Repeat emergency announcement every 10 seconds
        this.alertInterval = setInterval(() => {
            if (this.emergencyActive) {
                this.speak('Emergency assistance needed! Please help!');
                if (navigator.vibrate) {
                    navigator.vibrate([500, 200, 500, 200, 500]);
                }
            }
        }, 10000);
    },
    
    continuousVibration() {
        const vibrationPattern = [200, 100, 200, 100, 200, 500];
        const vibrate = () => {
            if (this.emergencyActive && navigator.vibrate) {
                navigator.vibrate(vibrationPattern);
                setTimeout(vibrate, 2000);
            }
        };
        vibrate();
    },
    
    cancelEmergency() {
        this.emergencyActive = false;
        
        // Clear timers
        if (this.emergencyTimer) {
            clearInterval(this.emergencyTimer);
            this.emergencyTimer = null;
        }
        
        if (this.alertInterval) {
            clearInterval(this.alertInterval);
            this.alertInterval = null;
        }
        
        // Hide modal
        this.emergencyModal.style.display = 'none';
        
        // Remove bystander alert
        this.closeBystanders();
        
        // Stop vibration
        if (navigator.vibrate) {
            navigator.vibrate(0);
        }
        
        this.speak('Emergency cancelled.');
        this.showAlert('Emergency cancelled', 'success');
    },
    
    closeBystanders() {
        if (this.bystanderAlert) {
            this.bystanderAlert.remove();
            this.bystanderAlert = null;
        }
    }
});

// Global emergency functions
function triggerEmergency() {
    window.mobileApp?.triggerEmergency();
}

function callEmergency() {
    window.mobileApp?.callEmergency();
}

function shareLocation() {
    window.mobileApp?.shareLocation();
}

function alertBystanders() {
    window.mobileApp?.alertBystanders();
}

function cancelEmergency() {
    window.mobileApp?.cancelEmergency();
}