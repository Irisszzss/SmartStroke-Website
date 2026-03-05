import cv2
import numpy as np
import socketio # pip install "python-socketio[client]"
import sys

# --- CONFIGURATION ---
MARKER_IDS = {"top_left": 0, "top_right": 1, "bottom_right": 2, "bottom_left": 3}

# FIXED: Set tracked area to match 2.44m x 1.17m exactly (1mm = 1px)
CANVAS_WIDTH, CANVAS_HEIGHT = 2440, 1170 

# !!! RENDER BACKEND INTEGRATION !!!
RENDER_URL = 'https://smartstroke-api.onrender.com'
sio = socketio.Client()
CLASS_ID = None

# --- SOCKET HANDSHAKE LOGIC ---
@sio.event
def connect():
    print(f"✅ Connected to Hosted Backend: {RENDER_URL}")
    sio.emit('python-ping')

@sio.on('camera-auto-join')
def on_auto_join(data):
    global CLASS_ID
    CLASS_ID = data if isinstance(data, str) else data.get('classId')
    print(f"🚀 AUTO-SYNCED! Joined Classroom: {CLASS_ID}")
    sio.emit('join-session', CLASS_ID)

@sio.on('board-available')
def on_board_available(class_id):
    global CLASS_ID
    CLASS_ID = class_id
    print(f"✨ Board Detected! Syncing to: {CLASS_ID}")
    sio.emit('join-session', CLASS_ID)

# --- CONNECT TO RENDER ---
try:
    sio.connect(RENDER_URL, transports=['websocket'])
except Exception as e:
    print(f"❌ Connection failed: {e}")

# 1. Initialize ArUco
aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
detector = cv2.aruco.ArucoDetector(aruco_dict)

# 2. Camera Setup
cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 2560)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1440)
cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

def get_marker_center(corners):
    return np.mean(corners.reshape((4, 2)), axis=0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    points = {}
    
    # Scale down for fast ArUco detection
    scale = 0.5
    small_gray = cv2.resize(frame, (0, 0), fx=scale, fy=scale)
    small_gray = cv2.cvtColor(small_gray, cv2.COLOR_BGR2GRAY)
    
    corners, ids, _ = detector.detectMarkers(small_gray)
    
    if ids is not None:
        for i, m_id in enumerate(ids.flatten()):
            if m_id in MARKER_IDS.values():
                points[m_id] = get_marker_center(corners[i][0]) / scale

    # --- PERSPECTIVE WARP (FLATTENING THE BOARD) ---
    if len(points) == 4:
        src_pts = np.array([
            points[MARKER_IDS["top_left"]], 
            points[MARKER_IDS["top_right"]],
            points[MARKER_IDS["bottom_right"]], 
            points[MARKER_IDS["bottom_left"]]
        ], dtype="float32")
        
        # FIXED: Forces the "Top Down View" to be 2440x1170 pixels
        dst_pts = np.array([
            [0, 0], 
            [CANVAS_WIDTH, 0], 
            [CANVAS_WIDTH, CANVAS_HEIGHT], 
            [0, CANVAS_HEIGHT]
        ], dtype="float32")

        M = cv2.getPerspectiveTransform(src_pts, dst_pts)
        warped = cv2.warpPerspective(frame, M, (CANVAS_WIDTH, CANVAS_HEIGHT))

        # --- GREEN TIP DETECTION ---
        hsv = cv2.cvtColor(warped, cv2.COLOR_BGR2HSV)
        
        lower_green = np.array([35, 100, 100])
        upper_green = np.array([90, 255, 255])
        
        mask = cv2.inRange(hsv, lower_green, upper_green)
        mask = cv2.GaussianBlur(mask, (5, 5), 0)
        mask = cv2.erode(mask, None, iterations=2)
        mask = cv2.dilate(mask, None, iterations=2)
        
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            largest = max(contours, key=cv2.contourArea)
            if cv2.contourArea(largest) > 40:
                M_moments = cv2.moments(largest)
                if M_moments["m00"] != 0:
                    gx = int(M_moments["m10"] / M_moments["m00"])
                    gy = int(M_moments["m01"] / M_moments["m00"])
                    
                    # --- EMIT COORDINATES TO RENDER ---
                    if CLASS_ID:
                        sio.emit('transmit-cv-pos', {'classId': CLASS_ID, 'x': gx, 'y': gy})

                    # Draw the tracking feedback on the flattened view
                    cv2.circle(warped, (gx, gy), 10, (0, 255, 0), -1)
                    cv2.circle(warped, (gx, gy), 12, (255, 255, 255), 2)

                    coord_text = f"X: {gx}, Y: {gy}"
                    cv2.putText(warped, coord_text, (gx + 15, gy + 5),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        # Show the exactly scaled Top-Down View (Resized only for display)
        cv2.imshow("SmartStroke - Top Down View", cv2.resize(warped, (960, 460)))
    
    # Raw feed for camera alignment
    cv2.imshow("Raw Setup Feed", cv2.resize(frame, (960, 540)))

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
sio.disconnect()