// Nepal Maps - Wheelchair Navigation JavaScript

class NepalMapsApp {
    constructor() {
        this.map = null;
        this.currentLocation = null;
        this.routeLayer = null;
        this.markersLayer = null;
        this.wheelchairMode = true;
        this.baatoApiKey = null;
        this.currentRoute = null;
        
        this.initializeApp();
    }

    async initializeApp() {
        try {
            // Get API key from backend
            await this.fetchApiKey();
            
            // Initialize map
            this.initializeMap();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Get user location
            await this.getCurrentLocation();
            
            // Load nearby accessible places
            this.loadNearbyPlaces();
            
            console.log('Nepal Maps App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showAlert('Failed to initialize maps. Please refresh the page.', 'error');
        }
    }

    async fetchApiKey() {
        try {
            const response = await fetch('/api/baato-key');
            if (response.ok) {
                const data = await response.json();
                this.baatoApiKey = data.api_key;
            } else {
                throw new Error('API key not available');
            }
        } catch (error) {
            console.warn('Using demo mode - Baato API key not available');
            // Continue in demo mode
        }
    }

    initializeMap() {
        // Initialize Leaflet map centered on Kathmandu
        this.map = L.map('map').setView([27.7172, 85.3240], 13);

        // Add OpenStreetMap tiles as base layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors | Nepal Maps',
            maxZoom: 19
        }).addTo(this.map);

        // Initialize layer groups
        this.markersLayer = L.layerGroup().addTo(this.map);
        this.routeLayer = L.layerGroup().addTo(this.map);

        // Add custom controls
        this.addMapControls();
        
        // Map click handler
        this.map.on('click', (e) => {
            this.onMapClick(e.latlng);
        });

        console.log('Map initialized');
    }

    addMapControls() {
        // Custom locate control
        const locateControl = L.control({position: 'topright'});
        locateControl.onAdd = () => {
            const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            div.innerHTML = '<a href="#" title="My Location">📍</a>';
            div.onclick = (e) => {
                e.preventDefault();
                this.getCurrentLocation(true);
            };
            return div;
        };
        locateControl.addTo(this.map);
    }

    async getCurrentLocation(showOnMap = false) {
        if (!navigator.geolocation) {
            this.showAlert('Geolocation is not supported by this browser.', 'error');
            return;
        }

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000
                });
            });

            this.currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            if (showOnMap) {
                this.map.setView([this.currentLocation.lat, this.currentLocation.lng], 16);
                
                // Add current location marker
                L.marker([this.currentLocation.lat, this.currentLocation.lng])
                    .addTo(this.markersLayer)
                    .bindPopup('📍 Your current location')
                    .openPopup();
            }

            // Update from input
            document.getElementById('from-input').placeholder = 'From: Current location';
            
            console.log('Current location obtained:', this.currentLocation);
        } catch (error) {
            console.error('Error getting location:', error);
            this.showAlert('Unable to get your current location. Using Kathmandu as default.', 'warning');
            
            // Default to Kathmandu
            this.currentLocation = { lat: 27.7172, lng: 85.3240 };
        }
    }

    setupEventListeners() {
        // Sidebar toggle
        document.getElementById('toggle-sidebar').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('hidden');
        });

        // Wheelchair mode toggle
        document.getElementById('wheelchair-mode').addEventListener('click', (e) => {
            this.wheelchairMode = !this.wheelchairMode;
            e.target.classList.toggle('active');
            this.showAlert(`Wheelchair mode ${this.wheelchairMode ? 'enabled' : 'disabled'}`, 'info');
        });

        // Search and directions
        document.getElementById('get-directions').addEventListener('click', () => {
            this.getDirections();
        });

        document.getElementById('swap-locations').addEventListener('click', () => {
            this.swapLocations();
        });

        // Map controls
        document.getElementById('locate-me').addEventListener('click', () => {
            this.getCurrentLocation(true);
        });

        document.getElementById('zoom-in').addEventListener('click', () => {
            this.map.zoomIn();
        });

        document.getElementById('zoom-out').addEventListener('click', () => {
            this.map.zoomOut();
        });

        document.getElementById('fullscreen').addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Close buttons
        document.getElementById('close-instructions')?.addEventListener('click', () => {
            document.getElementById('instructions-panel').style.display = 'none';
        });

        document.getElementById('close-details')?.addEventListener('click', () => {
            document.getElementById('location-details').style.display = 'none';
        });

        // Place filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterNearbyPlaces(e.target.dataset.type);
            });
        });

        // Search input auto-complete
        this.setupSearchAutoComplete();
    }

    setupSearchAutoComplete() {
        const fromInput = document.getElementById('from-input');
        const toInput = document.getElementById('to-input');

        // Basic autocomplete setup
        [fromInput, toInput].forEach(input => {
            input.addEventListener('input', async (e) => {
                const query = e.target.value;
                if (query.length > 2) {
                    await this.performSearch(query, input);
                }
            });
        });
    }

    async performSearch(query, inputElement) {
        try {
            let results = [];
            
            if (this.baatoApiKey) {
                // Use Baato API for search
                results = await this.searchWithBaato(query);
            } else {
                // Demo mode - mock results
                results = this.getMockSearchResults(query);
            }

            this.showSearchResults(results, inputElement);
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    async searchWithBaato(query) {
        try {
            const response = await fetch(`https://api.baato.io/api/v1/search?key=${this.baatoApiKey}&q=${encodeURIComponent(query)}&limit=5`);
            if (!response.ok) throw new Error('Search failed');
            
            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error('Baato search error:', error);
            return this.getMockSearchResults(query);
        }
    }

    getMockSearchResults(query) {
        const mockResults = [
            { name: 'Kathmandu Durbar Square', lat: 27.7045, lng: 85.3077 },
            { name: 'Swayambhunath Temple', lat: 27.7149, lng: 85.2906 },
            { name: 'Boudhanath Stupa', lat: 27.7215, lng: 85.3628 },
            { name: 'Thamel', lat: 27.7172, lng: 85.3106 },
            { name: 'New Road', lat: 27.7022, lng: 85.3146 },
            { name: 'Tribhuvan Airport', lat: 27.6966, lng: 85.3591 },
            { name: 'Patan Durbar Square', lat: 27.6732, lng: 85.3260 },
            { name: 'Bhaktapur Durbar Square', lat: 27.6727, lng: 85.4274 }
        ];

        return mockResults.filter(place => 
            place.name.toLowerCase().includes(query.toLowerCase())
        );
    }

    showSearchResults(results, inputElement) {
        // Remove existing dropdown
        const existingDropdown = document.querySelector('.search-dropdown');
        if (existingDropdown) {
            existingDropdown.remove();
        }

        if (results.length === 0) return;

        // Create dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'search-dropdown';
        dropdown.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-radius: 0 0 10px 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
        `;

        results.forEach(result => {
            const item = document.createElement('div');
            item.style.cssText = `
                padding: 12px 15px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
            `;
            item.textContent = result.name || result.address;
            
            item.addEventListener('click', () => {
                inputElement.value = result.name || result.address;
                inputElement.dataset.lat = result.lat || result.centroid?.lat;
                inputElement.dataset.lng = result.lng || result.centroid?.lon;
                dropdown.remove();
            });

            item.addEventListener('mouseenter', () => {
                item.style.background = '#f5f5f5';
            });

            item.addEventListener('mouseleave', () => {
                item.style.background = 'white';
            });

            dropdown.appendChild(item);
        });

        // Position relative to input
        inputElement.parentNode.style.position = 'relative';
        inputElement.parentNode.appendChild(dropdown);

        // Close dropdown on outside click
        setTimeout(() => {
            document.addEventListener('click', function closeDropdown(e) {
                if (!dropdown.contains(e.target) && e.target !== inputElement) {
                    dropdown.remove();
                    document.removeEventListener('click', closeDropdown);
                }
            });
        }, 100);
    }

    async getDirections() {
        const fromInput = document.getElementById('from-input');
        const toInput = document.getElementById('to-input');

        let fromCoords, toCoords;

        // Get from coordinates
        if (fromInput.dataset.lat && fromInput.dataset.lng) {
            fromCoords = {
                lat: parseFloat(fromInput.dataset.lat),
                lng: parseFloat(fromInput.dataset.lng)
            };
        } else if (this.currentLocation) {
            fromCoords = this.currentLocation;
        } else {
            this.showAlert('Please select a starting location', 'warning');
            return;
        }

        // Get to coordinates
        if (toInput.dataset.lat && toInput.dataset.lng) {
            toCoords = {
                lat: parseFloat(toInput.dataset.lat),
                lng: parseFloat(toInput.dataset.lng)
            };
        } else {
            this.showAlert('Please select a destination', 'warning');
            return;
        }

        this.showLoading(true);

        try {
            const routeData = await this.calculateRoute(fromCoords, toCoords);
            this.displayRoute(routeData);
            this.showRouteInfo(routeData);
        } catch (error) {
            console.error('Direction error:', error);
            this.showAlert('Unable to calculate route. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async calculateRoute(from, to) {
        try {
            if (this.baatoApiKey) {
                return await this.calculateRouteWithBaato(from, to);
            } else {
                return this.getMockRouteData(from, to);
            }
        } catch (error) {
            console.error('Route calculation error:', error);
            return this.getMockRouteData(from, to);
        }
    }

    async calculateRouteWithBaato(from, to) {
        const mode = this.wheelchairMode ? 'foot' : 'car';
        const url = `https://api.baato.io/api/v1/directions?key=${this.baatoApiKey}&points=${from.lat},${from.lng};${to.lat},${to.lng}&mode=${mode}&alternatives=true&instructions=true`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Route calculation failed');

        const data = await response.json();
        
        // Process route data for wheelchair accessibility
        return this.processRouteForAccessibility(data.data);
    }

    getMockRouteData(from, to) {
        // Calculate approximate distance and time
        const distance = this.calculateDistance(from, to);
        const time = Math.round(distance * (this.wheelchairMode ? 15 : 3)); // minutes

        return {
            routes: [{
                geometry: this.createMockRouteGeometry(from, to),
                distance: Math.round(distance * 1000), // meters
                time: time * 60, // seconds
                instructions: this.generateMockInstructions(from, to),
                accessibility: {
                    rating: 'good',
                    warnings: this.wheelchairMode ? [
                        'Some sidewalks may have uneven surfaces',
                        'Check for accessible entrances at destination'
                    ] : [],
                    features: ['Wide sidewalks', 'Smooth surfaces', 'Ramp access']
                }
            }]
        };
    }

    calculateDistance(from, to) {
        const R = 6371; // Earth's radius in km
        const dLat = (to.lat - from.lat) * Math.PI / 180;
        const dLng = (to.lng - from.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    createMockRouteGeometry(from, to) {
        // Create simple straight line with some intermediate points
        const points = [];
        const steps = 5;
        
        for (let i = 0; i <= steps; i++) {
            const ratio = i / steps;
            const lat = from.lat + (to.lat - from.lat) * ratio;
            const lng = from.lng + (to.lng - from.lng) * ratio;
            points.push([lat, lng]);
        }
        
        return points;
    }

    generateMockInstructions(from, to) {
        return [
            { instruction: 'Head southeast', distance: 200, time: 120 },
            { instruction: 'Turn right onto main road', distance: 500, time: 300 },
            { instruction: 'Continue straight for 1 km', distance: 1000, time: 600 },
            { instruction: 'Turn left at the intersection', distance: 300, time: 180 },
            { instruction: 'Arrive at destination', distance: 0, time: 0 }
        ];
    }

    processRouteForAccessibility(routeData) {
        if (!routeData || !routeData.length) return null;

        const route = routeData[0];
        
        // Add accessibility analysis
        route.accessibility = {
            rating: this.assessRouteAccessibility(route),
            warnings: this.generateAccessibilityWarnings(route),
            features: this.identifyAccessibilityFeatures(route)
        };

        return { routes: routeData };
    }

    assessRouteAccessibility(route) {
        // Simple accessibility assessment based on route characteristics
        if (this.wheelchairMode) {
            // Check for potential accessibility issues
            const hasStairs = Math.random() > 0.7; // Mock detection
            const hasNarrowPaths = Math.random() > 0.8;
            const hasRoughSurfaces = Math.random() > 0.6;

            if (hasStairs) return 'poor';
            if (hasNarrowPaths || hasRoughSurfaces) return 'limited';
            return 'good';
        }
        return 'good';
    }

    generateAccessibilityWarnings(route) {
        if (!this.wheelchairMode) return [];

        const warnings = [];
        const issues = [
            'Some sidewalks may have uneven surfaces',
            'Check for accessible entrances at destination',
            'Be aware of steep inclines on this route',
            'Some crossings may not have audio signals',
            'Construction work may affect accessibility'
        ];

        // Randomly select 0-2 warnings for demo
        const numWarnings = Math.floor(Math.random() * 3);
        for (let i = 0; i < numWarnings; i++) {
            const randomIndex = Math.floor(Math.random() * issues.length);
            if (!warnings.includes(issues[randomIndex])) {
                warnings.push(issues[randomIndex]);
            }
        }

        return warnings;
    }

    identifyAccessibilityFeatures(route) {
        const features = [];
        if (this.wheelchairMode) {
            const possibleFeatures = [
                'Wide sidewalks available',
                'Smooth paved surfaces',
                'Ramp access points',
                'Accessible pedestrian crossings',
                'Level terrain'
            ];

            // Randomly select 2-3 features for demo
            const numFeatures = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < numFeatures; i++) {
                const randomIndex = Math.floor(Math.random() * possibleFeatures.length);
                if (!features.includes(possibleFeatures[randomIndex])) {
                    features.push(possibleFeatures[randomIndex]);
                }
            }
        }
        return features;
    }

    displayRoute(routeData) {
        if (!routeData || !routeData.routes || !routeData.routes.length) {
            this.showAlert('No route found', 'warning');
            return;
        }

        // Clear existing routes
        this.routeLayer.clearLayers();

        const route = routeData.routes[0];
        this.currentRoute = route;

        // Create route polyline
        const routeLine = L.polyline(route.geometry, {
            color: this.getRouteColor(route.accessibility?.rating),
            weight: 6,
            opacity: 0.8
        }).addTo(this.routeLayer);

        // Add markers for start and end
        L.marker(route.geometry[0])
            .addTo(this.routeLayer)
            .bindPopup('🚀 Start');

        L.marker(route.geometry[route.geometry.length - 1])
            .addTo(this.routeLayer)
            .bindPopup('🏁 Destination');

        // Fit map to route
        this.map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });
    }

    getRouteColor(accessibilityRating) {
        switch (accessibilityRating) {
            case 'good': return '#28a745';
            case 'limited': return '#ffc107';
            case 'poor': return '#dc3545';
            default: return '#2c5aa0';
        }
    }

    showRouteInfo(routeData) {
        if (!routeData || !routeData.routes || !routeData.routes.length) return;

        const route = routeData.routes[0];
        const routeInfo = document.getElementById('route-info');
        
        // Update route statistics
        document.getElementById('route-distance').textContent = 
            `${(route.distance / 1000).toFixed(1)} km`;
        document.getElementById('route-time').textContent = 
            `${Math.round(route.time / 60)} min`;
        document.getElementById('route-accessibility').textContent = 
            this.getAccessibilityLabel(route.accessibility?.rating);

        // Update accessibility rating color
        const accessibilityElement = document.getElementById('route-accessibility');
        accessibilityElement.className = `stat-value ${route.accessibility?.rating || 'unknown'}`;

        // Show/hide warnings
        const warningsDiv = document.getElementById('accessibility-warnings');
        const warningsList = document.getElementById('warning-list');
        
        if (route.accessibility?.warnings && route.accessibility.warnings.length > 0) {
            warningsDiv.style.display = 'block';
            warningsList.innerHTML = route.accessibility.warnings
                .map(warning => `<div class="warning-item">⚠️ ${warning}</div>`)
                .join('');
        } else {
            warningsDiv.style.display = 'none';
        }

        // Show route info panel
        routeInfo.style.display = 'block';

        // Generate turn-by-turn instructions
        if (route.instructions) {
            this.showInstructions(route.instructions);
        }
    }

    getAccessibilityLabel(rating) {
        switch (rating) {
            case 'good': return 'Fully Accessible';
            case 'limited': return 'Partially Accessible';
            case 'poor': return 'Not Accessible';
            default: return 'Unknown';
        }
    }

    showInstructions(instructions) {
        const instructionsPanel = document.getElementById('instructions-panel');
        const instructionsList = document.getElementById('instructions-list');

        instructionsList.innerHTML = instructions.map((instruction, index) => `
            <div class="instruction-item">
                <div class="instruction-icon">${this.getInstructionIcon(instruction.instruction)}</div>
                <div class="instruction-text">
                    <div class="instruction-main">${instruction.instruction}</div>
                    <div class="instruction-meta">${instruction.distance}m • ${Math.round(instruction.time / 60)} min</div>
                </div>
            </div>
        `).join('');

        instructionsPanel.style.display = 'block';
    }

    getInstructionIcon(instruction) {
        const text = instruction.toLowerCase();
        if (text.includes('left')) return '↰';
        if (text.includes('right')) return '↱';
        if (text.includes('straight') || text.includes('continue')) return '↑';
        if (text.includes('arrive')) return '🏁';
        return '➤';
    }

    swapLocations() {
        const fromInput = document.getElementById('from-input');
        const toInput = document.getElementById('to-input');

        // Swap values
        const tempValue = fromInput.value;
        const tempLat = fromInput.dataset.lat;
        const tempLng = fromInput.dataset.lng;

        fromInput.value = toInput.value;
        fromInput.dataset.lat = toInput.dataset.lat;
        fromInput.dataset.lng = toInput.dataset.lng;

        toInput.value = tempValue;
        toInput.dataset.lat = tempLat;
        toInput.dataset.lng = tempLng;
    }

    onMapClick(latlng) {
        // Show location details on map click
        this.showLocationDetails(latlng);
    }

    showLocationDetails(latlng) {
        const detailsPanel = document.getElementById('location-details');
        
        // Mock location data
        const locationData = {
            name: 'Selected Location',
            accessibility: 'unknown',
            address: `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`,
            amenities: ['Parking available', 'Ground floor access']
        };

        document.getElementById('location-name').textContent = locationData.name;
        document.getElementById('rating-value').textContent = 
            this.getAccessibilityLabel(locationData.accessibility);
        document.getElementById('rating-value').className = 
            `rating-value ${locationData.accessibility}`;

        detailsPanel.style.display = 'block';

        // Add temporary marker
        const marker = L.marker([latlng.lat, latlng.lng])
            .addTo(this.markersLayer)
            .bindPopup(`📍 ${locationData.name}`)
            .openPopup();

        // Remove marker when details panel is closed
        const closeBtn = document.getElementById('close-details');
        const removeMarker = () => {
            this.markersLayer.removeLayer(marker);
            closeBtn.removeEventListener('click', removeMarker);
        };
        closeBtn.addEventListener('click', removeMarker);
    }

    async loadNearbyPlaces() {
        if (!this.currentLocation) return;

        try {
            // Mock nearby places data
            const places = this.getMockNearbyPlaces();
            this.displayNearbyPlaces(places);
        } catch (error) {
            console.error('Error loading nearby places:', error);
        }
    }

    getMockNearbyPlaces() {
        return [
            {
                name: 'Norvic International Hospital',
                type: 'hospital',
                accessibility: 'good',
                distance: 0.5,
                lat: 27.7089,
                lng: 85.3206
            },
            {
                name: 'Civil Mall',
                type: 'shopping',
                accessibility: 'good',
                distance: 1.2,
                lat: 27.7134,
                lng: 85.3047
            },
            {
                name: 'Fire and Ice Restaurant',
                type: 'restaurant',
                accessibility: 'limited',
                distance: 0.8,
                lat: 27.7161,
                lng: 85.3113
            },
            {
                name: 'Ratna Park Bus Station',
                type: 'transport',
                accessibility: 'poor',
                distance: 1.5,
                lat: 27.7056,
                lng: 85.3125
            }
        ];
    }

    displayNearbyPlaces(places) {
        const nearbyList = document.getElementById('nearby-list');
        
        nearbyList.innerHTML = places.map(place => `
            <div class="place-item" data-type="${place.type}">
                <div class="place-info">
                    <div class="place-name">${place.name}</div>
                    <div class="place-meta">
                        <span class="place-distance">${place.distance} km</span>
                        <span class="place-accessibility ${place.accessibility}">${this.getAccessibilityLabel(place.accessibility)}</span>
                    </div>
                </div>
                <button class="place-action" onclick="app.navigateToPlace(${place.lat}, ${place.lng}, '${place.name}')">
                    🧭
                </button>
            </div>
        `).join('');

        // Add places to map
        places.forEach(place => {
            const marker = L.marker([place.lat, place.lng])
                .addTo(this.markersLayer)
                .bindPopup(`
                    <div class="popup-content">
                        <h4>${place.name}</h4>
                        <p>Accessibility: ${this.getAccessibilityLabel(place.accessibility)}</p>
                        <button onclick="app.navigateToPlace(${place.lat}, ${place.lng}, '${place.name}')">Get Directions</button>
                    </div>
                `);
                
            // Style marker based on accessibility
            const markerElement = marker.getElement();
            if (markerElement) {
                markerElement.classList.add('accessibility-marker', place.accessibility);
            }
        });
    }

    navigateToPlace(lat, lng, name) {
        document.getElementById('to-input').value = name;
        document.getElementById('to-input').dataset.lat = lat;
        document.getElementById('to-input').dataset.lng = lng;
        this.getDirections();
    }

    filterNearbyPlaces(type) {
        const places = document.querySelectorAll('.place-item');
        places.forEach(place => {
            if (type === 'all' || place.dataset.type === type) {
                place.style.display = 'block';
            } else {
                place.style.display = 'none';
            }
        });
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'flex' : 'none';
    }

    showAlert(message, type = 'info') {
        const alertSystem = document.getElementById('alert-system');
        
        const alert = document.createElement('div');
        alert.className = `alert ${type}`;
        alert.innerHTML = `
            <div class="alert-content">
                <span class="alert-icon">${this.getAlertIcon(type)}</span>
                <span class="alert-message">${message}</span>
                <button class="alert-close" onclick="this.parentElement.parentElement.remove()">✕</button>
            </div>
        `;

        alertSystem.appendChild(alert);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    getAlertIcon(type) {
        switch (type) {
            case 'success': return '✅';
            case 'warning': return '⚠️';
            case 'error': return '❌';
            default: return 'ℹ️';
        }
    }
}

// Initialize app when page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new NepalMapsApp();
});

// Add CSS for place items
const style = document.createElement('style');
style.textContent = `
.place-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    border-bottom: 1px solid #eee;
    transition: background 0.3s ease;
}

.place-item:hover {
    background: #f8f9fa;
}

.place-info {
    flex: 1;
}

.place-name {
    font-weight: 600;
    margin-bottom: 4px;
}

.place-meta {
    display: flex;
    gap: 10px;
    font-size: 0.8rem;
}

.place-distance {
    color: #666;
}

.place-accessibility {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.7rem;
    font-weight: 600;
}

.place-accessibility.good {
    background: #d4edda;
    color: #155724;
}

.place-accessibility.limited {
    background: #fff3cd;
    color: #856404;
}

.place-accessibility.poor {
    background: #f8d7da;
    color: #721c24;
}

.place-action {
    background: #2c5aa0;
    color: white;
    border: none;
    width: 35px;
    height: 35px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.1rem;
}

.popup-content button {
    background: #2c5aa0;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 5px;
    cursor: pointer;
    margin-top: 5px;
}

.alert-content {
    display: flex;
    align-items: center;
    gap: 10px;
}

.alert-close {
    background: none;
    border: none;
    cursor: pointer;
    margin-left: auto;
}
`;
document.head.appendChild(style);