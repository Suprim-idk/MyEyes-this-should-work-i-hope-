from flask import Flask, render_template, jsonify
from flask_socketio import SocketIO, emit
import threading
import time
import random
import json

app = Flask(__name__)
app.config['SECRET_KEY'] = 'navigation_system_key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Navigation system state
navigation_state = {
    'is_running': False,
    'mode': 'demo',  # 'demo' or 'camera'
    'distance': 0,
    'direction': '',
    'last_instruction': '',
    'obstacle_detected': False
}

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

@socketio.on('start_navigation')
def handle_start_navigation():
    navigation_state['is_running'] = True
    navigation_state['mode'] = 'demo'  # Will be 'camera' when camera is available
    
    # Start navigation in a separate thread
    thread = threading.Thread(target=navigation_simulation)
    thread.daemon = True
    thread.start()
    
    emit('navigation_started', {'message': 'Navigation system started'})

@socketio.on('stop_navigation')
def handle_stop_navigation():
    navigation_state['is_running'] = False
    navigation_state['last_instruction'] = 'Navigation stopped'
    emit('navigation_stopped', {'message': 'Navigation system stopped'})

@socketio.on('connect')
def handle_connect():
    emit('connected', {'message': 'Connected to navigation system'})

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)