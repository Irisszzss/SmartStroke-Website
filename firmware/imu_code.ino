#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Wire.h>
#include <Adafruit_BNO08x.h>

// --- PIN DEFINITIONS ---
#define I2C_SDA 21
#define I2C_SCL 22
#define FSR_PIN 34
#define BTN_NEW_PAGE 32
#define BTN_UNDO 33
#define BTN_RECENTER 25  // Used here as the toggle/recenter button

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLECharacteristic *pCharacteristic;
bool deviceConnected = false;
bool isPowerOn = true; 
unsigned long lastBtnPress = 0;

Adafruit_BNO08x bno08x;
sh2_SensorValue_t sensorValue;

const uint32_t sendInterval = 40; // 25Hz broadcast
unsigned long lastSend = 0;

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) { deviceConnected = true; }
  void onDisconnect(BLEServer*) {
    deviceConnected = false;
    BLEDevice::startAdvertising();
  }
};

void setup() {
  Serial.begin(115200);
  
  Wire.begin(I2C_SDA, I2C_SCL);

  if (!bno08x.begin_I2C(0x4A) && !bno08x.begin_I2C(0x4B)) {
    Serial.println("BNO085 not found!");
    while (1) delay(10); 
  }

  bno08x.enableReport(SH2_GAME_ROTATION_VECTOR, 5000);
  
  pinMode(FSR_PIN, INPUT);
  pinMode(BTN_NEW_PAGE, INPUT_PULLUP);
  pinMode(BTN_UNDO, INPUT_PULLUP);
  pinMode(BTN_RECENTER, INPUT_PULLUP);
  
  analogReadResolution(12); // ESP32 resolution

  BLEDevice::init("SmartStrokes-Pen");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_NOTIFY
                    );
  pCharacteristic->addDescriptor(new BLE2902());
  pService->start();
  
  BLEDevice::startAdvertising();
  Serial.println("SmartStroke Pen Ready...");
}

void loop() {
  // Power/Recenter Toggle Logic
  if (digitalRead(BTN_RECENTER) == LOW && (millis() - lastBtnPress > 500)) {
    isPowerOn = !isPowerOn;
    lastBtnPress = millis();
    Serial.print("System Power: "); Serial.println(isPowerOn);
  }

  if (!isPowerOn || !deviceConnected) return;

  if (bno08x.getSensorEvent(&sensorValue)) {
    if (sensorValue.sensorId == SH2_GAME_ROTATION_VECTOR) {
      if (millis() - lastSend >= sendInterval) {
        lastSend = millis();

        // Read Buttons (LOW means pressed due to INPUT_PULLUP)
        int newPageBtn = (digitalRead(BTN_NEW_PAGE) == LOW) ? 1 : 0;
        int undoBtn    = (digitalRead(BTN_UNDO) == LOW) ? 1 : 0;
        int fsrReading = analogRead(FSR_PIN);
        
        // Determine "Down" state (threshold can be adjusted)
        int isDown = (fsrReading > 400) ? 1 : 0; 

        // Construct JSON for React Dashboard
        // un: Undo, np: New Page, pdf: Export
        String json = "{";
        json += "\"r\":" + String(sensorValue.un.gameRotationVector.real, 4) + ",";
        json += "\"i\":" + String(sensorValue.un.gameRotationVector.i, 4) + ",";
        json += "\"j\":" + String(sensorValue.un.gameRotationVector.j, 4) + ",";
        json += "\"k\":" + String(sensorValue.un.gameRotationVector.k, 4) + ",";
        json += "\"p\":" + String(fsrReading) + ",";
        json += "\"d\":" + String(isDown) + ",";
        json += "\"np\":" + String(newPageBtn) + ",";
        json += "\"un\":" + String(undoBtn) + ",";
        json += "\"pdf\":0"; // Set to 1 if you add a dedicated export button
        json += "}";
        
        pCharacteristic->setValue(json.c_str());
        pCharacteristic->notify();
      }
    }
  }
}