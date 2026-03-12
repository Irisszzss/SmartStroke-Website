import cv2
import numpy as np
import socketio
import sys

# --- CONFIGURATION ---
# The known physical width of your printed ArUco marker in millimeters
MARKER_PHYSICAL_SIZE_MM = 70  
MARKER_IDS = {"top_left": 0, "top_right": 1, "bottom_right": 2, "bottom_left": 3}

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

def get_dist(p1, p2):
    return np.linalg.norm(p1 - p2)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    points = {}
    scale = 0.5
    small_gray = cv2.resize(frame, (0, 0), fx=scale, fy=scale)
    small_gray = cv2.cvtColor(small_gray, cv2.COLOR_BGR2GRAY)
    
    corners, ids, _ = detector.detectMarkers(small_gray)
    
    px_per_mm = None

    if ids is not None:
        for i, m_id in enumerate(ids.flatten()):
            if m_id in MARKER_IDS.values():
                # Scale corners back to original frame size
                m_corners = corners[i][0] / scale
                
                # CALIBRATION: Measure marker width in pixels to find the scale
                # 70mm / pixel_width = pixel-to-mm ratio
                line_width_px = get_dist(m_corners[0], m_corners[1])
                px_per_mm = line_width_px / MARKER_PHYSICAL_SIZE_MM
                
                points[m_id] = get_marker_center(m_corners)

    # --- DYNAMIC PERSPECTIVE WARP & AUTO-MEASURE ---
    if len(points) == 4 and px_per_mm:
        # Calculate real-world distance between marker centers
        width_mm = get_dist(points[MARKER_IDS["top_left"]], points[MARKER_IDS["top_right"]]) / px_per_mm
        height_mm = get_dist(points[MARKER_IDS["top_left"]], points[MARKER_IDS["bottom_left"]]) / px_per_mm

        # Set board edges (Adding 50mm padding outside marker centers)
        # Change PADDING to 0 if markers are at the absolute corners
        PADDING = 50 
        total_board_w = int(width_mm + (PADDING * 2))
        total_board_h = int(height_mm + (PADDING * 2))

        src_pts = np.array([
            points[MARKER_IDS["top_left"]], 
            points[MARKER_IDS["top_right"]],
            points[MARKER_IDS["bottom_right"]], 
            points[MARKER_IDS["bottom_left"]]
        ], dtype="float32")
        
        dst_pts = np.array([
            [PADDING, PADDING], 
            [PADDING + width_mm, PADDING], 
            [PADDING + width_mm, PADDING + height_mm], 
            [PADDING, PADDING + height_mm]
        ], dtype="float32")

        M = cv2.getPerspectiveTransform(src_pts, dst_pts)
        warped = cv2.warpPerspective(frame, M, (total_board_w, total_board_h))

        # --- GREEN TIP DETECTION ---
        hsv = cv2.cvtColor(warped, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, np.array([35, 100, 100]), np.array([90, 255, 255]))
        mask = cv2.dilate(cv2.erode(mask, None, iterations=2), None, iterations=2)
        
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            largest = max(contours, key=cv2.contourArea)
            if cv2.contourArea(largest) > 40:
                M_m = cv2.moments(largest)
                if M_m["m00"] != 0:
                    gx = int(M_m["m10"] / M_m["m00"])
                    gy = int(M_m["m01"] / M_m["m00"])
                    
                    # --- NORMALIZED COORDINATES (0.0 to 1.0) ---
                    # This is key! It tells React WHERE on the board you are, 
                    # regardless of the physical size.
                    norm_x = round(gx / total_board_w, 4)
                    norm_y = round(gy / total_board_h, 4)
                    
                    if CLASS_ID:
                        # Send percentages to the backend
                        sio.emit('transmit-cv-pos', {'classId': CLASS_ID, 'x': norm_x, 'y': norm_y})

                    # Visual feedback on the warped view
                    cv2.circle(warped, (gx, gy), 10, (0, 255, 0), -1)

        # Show the flattened view (automatically sized)
        preview_h = 400
        preview_w = int(preview_h * (total_board_w / total_board_h))
        cv2.imshow("SmartStroke - Auto Scaled View", cv2.resize(warped, (preview_w, preview_h)))
    
    cv2.imshow("Raw Setup Feed", cv2.resize(frame, (960, 540)))

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
sio.disconnect()