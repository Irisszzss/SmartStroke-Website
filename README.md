# SmartStroke: A Sensor-Enhanced Marker Attachment for Handwriting Digitization

SmartStroke is an intelligent handwriting digitization system that transforms physical strokes into digital data. By fusing Computer Vision (OpenCV) with Inertial Measurement Units (IMU), the system captures real-time handwriting with high precision without the need for specialized digital paper.

---

## 🚀 Overview

The project utilizes a **hybrid approach** to track movement:

- **Computer Vision:** An OpenCV pipeline (managed via `blue.py`) tracks the physical marker's position using a camera.
- **Inertial Sensing:** A **BNO085 9-axis IMU** captures **6-DOF motion and orientation data** to refine the stroke path.
- **Real-Time Visualization:** A **React-based web interface** provides immediate feedback of the digitized strokes.

---

## 🛠️ Technical Stack

**Embedded Hardware**
- ESP32
- BNO085 IMU
- Force Sensitive Resistor (FSR)

**Vision Engine**
- Python
- OpenCV

**Web Frontend**
- React.js
- Vite
- Tailwind CSS

**Backend & Real-time Communication**
- Node.js
- Express.js
- Socket.IO

**Algorithms**
- Madgwick Filter
- Extended Kalman Filter (EKF) for sensor fusion

---

## 🔧 Getting Started

### 1️⃣ Vision Setup

Install the Python dependencies for the tracking engine:

```bash
pip install opencv-python numpy
python blue.py

2️⃣ Frontend Setup

Install the web dependencies and start the development server:

```bash
npm install
npm run dev

3️⃣ Firmware

Upload the contents of the firmware/ directory to your ESP32 using the Arduino IDE.
