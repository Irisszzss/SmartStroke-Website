# SmartStroke: A Sensor-Enhanced Marker Attachment for Handwriting Digitization

**SmartStroke** is an intelligent handwriting digitization system that transforms physical strokes into digital data. By fusing **Computer Vision (OpenCV)** with **Inertial Measurement Units (IMU)**, the system captures real-time handwriting with high precision without the need for specialized digital paper.

## 🚀 Overview

The project utilizes a **hybrid approach** to track movement:

* **Computer Vision:** An **OpenCV** pipeline (managed via `blue.py`) tracks the physical marker's position using a camera.
* **Inertial Sensing:** A **BNO085 9-axis IMU** captures **6-DOF motion and orientation data** to refine the stroke path.
* **Real-Time Visualization:** A **React-based web interface** provides immediate feedback of the digitized strokes.

---

## 🏗️ Project Structure

* 📂 `firmware/` — **C++** code for the **ESP32**, managing the **BNO085 IMU** and **FSR** sensors.
* 📂 `src/` — **React.js** frontend source code for the visualization dashboard.
* 📄 `blue.py` — Core **OpenCV** engine for visual marker tracking and coordinate mapping.
* 📄 `vercel.json` — Deployment configuration for hosting the web interface.

---

## 🛠️ Technical Stack

### **Embedded Hardware**

* **ESP32**: Main microcontroller for data acquisition.
* **BNO085 IMU**: 9-axis sensor for orientation and motion tracking.
* **Force Sensitive Resistor (FSR)**: Detects pen-down/pen-up pressure states.

### **Software Engine**

* **Vision Engine**: Python and **OpenCV** for spatial coordinate tracking.
* **Web Frontend**: **React.js**, Vite, and Tailwind CSS for a modern dashboard.
* **Backend**: **Node.js** and **Express.js** with **Socket.IO** for real-time data streaming.

### **Algorithms**

* **Madgwick Filter**: Used for orientation estimation.
* **Extended Kalman Filter (EKF)**: Performs sensor fusion between vision and IMU data.

---

## 🔧 Getting Started

### 1️⃣ Vision Setup

Install the Python dependencies for the tracking engine:

```bash
pip install opencv-python numpy
python blue.py

```

### 2️⃣ Frontend Setup

Install the web dependencies and start the development server:

```bash
npm install
npm run dev

```

### 3️⃣ Firmware

Upload the contents of the `firmware/` directory to your **ESP32** using the Arduino IDE.

---
