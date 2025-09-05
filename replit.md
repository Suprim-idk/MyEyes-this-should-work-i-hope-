# Navigation Assistant

## Overview

A real-time accessibility-focused navigation system designed for visually impaired users. The application combines Flask backend with WebSocket communication, depth estimation using MiDaS computer vision models, and text-to-speech functionality to provide audio navigation guidance. The system can operate in both demo mode (simulation) and camera mode (real-time depth analysis) to help users navigate obstacles safely.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **HTML/CSS/JavaScript Interface**: Clean, accessible web interface optimized for screen readers and keyboard navigation
- **WebSocket Client**: Real-time bidirectional communication using Socket.IO for instant navigation updates
- **Audio Feedback System**: Text-to-speech integration for spoken navigation instructions
- **Responsive Design**: Grid-based layout with large, high-contrast elements for accessibility

### Backend Architecture
- **Flask Web Server**: Lightweight Python web framework serving the main application
- **WebSocket Server**: Flask-SocketIO implementation for real-time communication between frontend and backend
- **Navigation State Management**: Centralized state object tracking system status, distance measurements, direction guidance, and obstacle detection
- **Simulation Engine**: Threading-based background process generating mock navigation data for demo purposes

### Computer Vision Pipeline
- **MiDaS Depth Estimation**: Intel's deep learning model (DPT_Large variant) for monocular depth estimation
- **PyTorch Integration**: GPU-accelerated inference when CUDA is available, falling back to CPU processing
- **Camera Input Processing**: OpenCV-based video capture supporting IP camera streams (e.g., smartphone cameras via DroidCam)
- **Frame Analysis**: Split-screen depth comparison between left and right visual fields for directional guidance

### Audio System
- **Text-to-Speech Engine**: pyttsx3 library providing configurable speech synthesis with adjustable rate and voice selection
- **Real-time Audio Feedback**: Immediate spoken instructions based on obstacle detection and navigation analysis

### Communication Architecture
- **RESTful API Endpoints**: Standard HTTP routes for status checking and system state queries
- **WebSocket Events**: Real-time event broadcasting for navigation updates, system status changes, and alert notifications
- **Cross-Origin Resource Sharing**: CORS-enabled WebSocket connections supporting diverse client environments

## External Dependencies

### Core Frameworks
- **Flask**: Python web framework for HTTP server and routing
- **Flask-SocketIO**: WebSocket implementation for real-time communication
- **OpenCV (cv2)**: Computer vision library for camera input and image processing

### Machine Learning & AI
- **PyTorch**: Deep learning framework for MiDaS model execution
- **Intel MiDaS Models**: Pre-trained depth estimation models loaded via torch.hub
- **NumPy**: Numerical computing library for array operations and depth map processing

### Audio Processing
- **pyttsx3**: Cross-platform text-to-speech synthesis library

### Frontend Libraries
- **Socket.IO Client**: JavaScript WebSocket client library for real-time communication

### Hardware Integrations
- **IP Camera Streams**: Support for smartphone cameras via network streaming (DroidCam or similar applications)
- **CUDA Support**: Optional GPU acceleration for depth estimation when available