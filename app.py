from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit
import threading
import time
import random
import json
import cv2
import numpy as np

app = Flask(__name__)
app.config['SECRET_KEY'] = 'navigation_system_key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Navigation system state
navigation_state = {
    'is_running': False,
    'mode': 'demo',  # 'demo', 'camera', or 'phone'
    'distance': 0,
    'direction': '',
    'last_instruction': '',
    'obstacle_detected': False,
    'camera_url': '',
    'camera_connected': False
}

# Camera configuration
camera_config = {
    'phone_ip': '',  # User's phone IP for camera streaming
    'usb_camera_id': 0,  # Default USB camera
    'current_camera': None
}

def analyze_camera_frame(frame):
    """Analyze camera frame for navigation guidance"""
    # Convert to grayscale for edge detection
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 100, 200)
    
    # Split frame into left and right halves
    height, width = edges.shape
    left_half = edges[:, :width//2]
    right_half = edges[:, width//2:]
    
    # Count edge pixels (lower count = more open space)
    left_score = np.sum(left_half) / 255
    right_score = np.sum(right_half) / 255
    
    # Estimate distance based on bottom portion of frame
    bottom_portion = edges[int(height*0.7):, :]
    edge_density = np.sum(bottom_portion) / (bottom_portion.shape[0] * bottom_portion.shape[1] * 255)
    
    # Convert edge density to distance estimate (rough approximation)
    estimated_distance = max(20, 200 - (edge_density * 1000))
    
    return {
        'distance': int(estimated_distance),
        'direction': 'left' if left_score < right_score else 'right'
    }

def navigation_with_camera():
    """Run navigation with real camera input"""
    cap = camera_config['current_camera']
    
    while navigation_state['is_running'] and cap is not None:
        ret, frame = cap.read()
        if not ret:
            navigation_state['camera_connected'] = False
            navigation_state['last_instruction'] = 'Camera connection lost - switching to demo mode'
            socketio.emit('navigation_update', navigation_state)
            # Fall back to simulation if camera fails
            navigation_simulation()
            break
            
        # Analyze frame for navigation
        analysis = analyze_camera_frame(frame)
        
        # Update state with real camera data
        navigation_state['distance'] = analysis['distance']
        navigation_state['direction'] = analysis['direction']
        navigation_state['obstacle_detected'] = analysis['distance'] < 50
        navigation_state['camera_connected'] = True
        navigation_state['mode'] = 'camera'
        
        if analysis['distance'] < 50:
            instruction = f"Turn {analysis['direction']} now"
            navigation_state['last_instruction'] = instruction
        else:
            navigation_state['last_instruction'] = "Path is clear"
        
        # Emit real-time update to frontend
        socketio.emit('navigation_update', navigation_state)
        
        time.sleep(0.1)  # Faster updates with camera

def navigation_enhanced_simulation():
    """Enhanced simulation that mimics camera behavior"""
    while navigation_state['is_running']:
        # More realistic simulation that varies based on time
        import math
        current_time = time.time()
        
        # Create realistic movement patterns
        base_distance = 100 + 50 * math.sin(current_time * 0.5)
        noise = random.randint(-20, 20)
        distance = max(15, int(base_distance + noise))
        
        # More intelligent direction changes
        if distance < 60:
            # When close to obstacles, prefer turning away from previous direction
            if hasattr(navigation_state, 'last_turn'):
                direction = 'right' if navigation_state.get('last_turn') == 'left' else 'left'
            else:
                direction = random.choice(['left', 'right'])
            navigation_state['last_turn'] = direction
        else:
            direction = random.choice(['left', 'right', 'straight'])
        
        # Update state
        navigation_state['distance'] = distance
        navigation_state['direction'] = direction
        navigation_state['obstacle_detected'] = distance < 50
        navigation_state['mode'] = 'enhanced_demo'
        
        if distance < 50:
            instruction = f"Turn {direction} now - obstacle at {distance}cm"
            navigation_state['last_instruction'] = instruction
        elif distance < 80:
            instruction = f"Caution - obstacle ahead at {distance}cm"
            navigation_state['last_instruction'] = instruction
        else:
            navigation_state['last_instruction'] = "Path is clear - safe to continue"
        
        # Emit real-time update to frontend
        socketio.emit('navigation_update', navigation_state)
        
        time.sleep(1.5)  # Balanced update speed

def navigation_simulation():
    """Simulate the navigation system for demo purposes"""
    while navigation_state['is_running']:
        # Generate random distance and direction
        distance = random.randint(10, 200)
        direction = random.choice(['left', 'right'])
        
        # Update state
        navigation_state['distance'] = distance
        navigation_state['direction'] = direction
        navigation_state['obstacle_detected'] = distance < 50
        
        if distance < 50:
            instruction = f"Turn {direction} now"
            navigation_state['last_instruction'] = instruction
        else:
            navigation_state['last_instruction'] = "Path is clear"
        
        # Emit real-time update to frontend
        socketio.emit('navigation_update', navigation_state)
        
        time.sleep(2)  # Update every 2 seconds

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/status')
def get_status():
    return jsonify(navigation_state)

@app.route('/api/camera/connect', methods=['POST'])
def connect_camera():
    data = request.get_json()
    camera_type = data.get('type', 'usb')  # 'usb' or 'phone'
    
    try:
        if camera_type == 'phone':
            phone_ip = data.get('ip', '')
            if not phone_ip:
                return jsonify({'success': False, 'message': 'Phone IP required'})
            
            # Try connecting to phone camera (DroidCam format)
            camera_url = f"http://{phone_ip}:4747/video"
            cap = cv2.VideoCapture(camera_url)
            
            if cap.isOpened():
                camera_config['current_camera'] = cap
                camera_config['phone_ip'] = phone_ip
                navigation_state['camera_url'] = camera_url
                navigation_state['camera_connected'] = True
                return jsonify({'success': True, 'message': f'Connected to phone camera at {phone_ip}'})
            else:
                return jsonify({'success': False, 'message': 'Could not connect to phone camera'})
                
        elif camera_type == 'usb':
            camera_id = data.get('id', 0)
            cap = cv2.VideoCapture(camera_id)
            
            if cap.isOpened():
                camera_config['current_camera'] = cap
                camera_config['usb_camera_id'] = camera_id
                navigation_state['camera_connected'] = True
                return jsonify({'success': True, 'message': f'Connected to USB camera {camera_id}'})
            else:
                return jsonify({'success': False, 'message': f'Could not connect to USB camera {camera_id}'})
                
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error connecting camera: {str(e)}'})
    
    return jsonify({'success': False, 'message': 'Unknown camera type'})

@app.route('/api/camera/disconnect', methods=['POST'])
def disconnect_camera():
    if camera_config['current_camera'] is not None:
        camera_config['current_camera'].release()
        camera_config['current_camera'] = None
        navigation_state['camera_connected'] = False
        navigation_state['camera_url'] = ''
        return jsonify({'success': True, 'message': 'Camera disconnected'})
    return jsonify({'success': False, 'message': 'No camera connected'})

@app.route('/api/camera/status')
def camera_status():
    return jsonify({
        'connected': navigation_state['camera_connected'],
        'url': navigation_state['camera_url'],
        'phone_ip': camera_config['phone_ip'],
        'usb_id': camera_config['usb_camera_id']
    })

@socketio.on('start_navigation')
def handle_start_navigation(data=None):
    navigation_state['is_running'] = True
    
    # Check if camera is available
    if camera_config['current_camera'] is not None:
        navigation_state['mode'] = 'camera'
        thread = threading.Thread(target=navigation_with_camera)
    else:
        navigation_state['mode'] = 'enhanced_demo'
        thread = threading.Thread(target=navigation_enhanced_simulation)
    
    thread.daemon = True
    thread.start()
    
    emit('navigation_started', {
        'message': f'Navigation started in {navigation_state["mode"]} mode',
        'mode': navigation_state['mode']
    })

@socketio.on('stop_navigation')
def handle_stop_navigation():
    navigation_state['is_running'] = False
    navigation_state['last_instruction'] = 'Navigation stopped'
    emit('navigation_stopped', {'message': 'Navigation system stopped'})

@socketio.on('connect_phone_camera')
def handle_connect_phone_camera(data):
    phone_ip = data.get('ip', '')
    if not phone_ip:
        emit('camera_error', {'message': 'Please provide phone IP address'})
        return
        
    try:
        camera_url = f"http://{phone_ip}:4747/video"
        cap = cv2.VideoCapture(camera_url)
        
        if cap.isOpened():
            # Test if we can actually read a frame
            ret, frame = cap.read()
            if ret:
                camera_config['current_camera'] = cap
                camera_config['phone_ip'] = phone_ip
                navigation_state['camera_url'] = camera_url
                navigation_state['camera_connected'] = True
                emit('camera_connected', {
                    'message': f'Successfully connected to phone camera',
                    'ip': phone_ip
                })
            else:
                cap.release()
                emit('camera_error', {'message': 'Camera connected but no video stream available'})
        else:
            emit('camera_error', {'message': 'Could not connect to phone camera. Check IP and DroidCam app.'})
            
    except Exception as e:
        emit('camera_error', {'message': f'Connection error: {str(e)}'})

@socketio.on('connect_usb_camera')
def handle_connect_usb_camera(data):
    camera_id = data.get('id', 0)
    
    try:
        cap = cv2.VideoCapture(camera_id)
        
        if cap.isOpened():
            ret, frame = cap.read()
            if ret:
                camera_config['current_camera'] = cap
                camera_config['usb_camera_id'] = camera_id
                navigation_state['camera_connected'] = True
                emit('camera_connected', {
                    'message': f'Successfully connected to USB camera {camera_id}'
                })
            else:
                cap.release()
                emit('camera_error', {'message': f'USB camera {camera_id} connected but no video available'})
        else:
            emit('camera_error', {'message': f'Could not connect to USB camera {camera_id}'})
            
    except Exception as e:
        emit('camera_error', {'message': f'USB camera error: {str(e)}'})

@socketio.on('connect')
def handle_connect():
    emit('connected', {'message': 'Connected to navigation system'})

if __name__ == '__main__':
    # Clean up cameras on exit
    import atexit
    def cleanup():
        if camera_config['current_camera'] is not None:
            camera_config['current_camera'].release()
    atexit.register(cleanup)
    
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)