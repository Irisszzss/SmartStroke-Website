#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Wire.h>
#include <Adafruit_BNO08x.h>

// --- PIN DEFINITIONS ---
#define I2C_SDA 8
#define I2C_SCL 9
#define FSR_PIN 1
#define BTN_NEW_PAGE 2
#define BTN_PWR_TOGGLE 3

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLECharacteristic *pCharacteristic;
bool deviceConnected = false;
bool isPowerOn = true; 
unsigned long lastBtnPress = 0;

Adafruit_BNO08x bno08x;
sh2_SensorValue_t sensorValue;

const uint32_t sendInterval = 40; 
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
  
  // Initialize I2C with specific S3 pins
  Wire.begin(I2C_SDA, I2C_SCL);

  // Adafruit boards usually use 0x4A by default, but can be 0x4B
  if (!bno08x.begin_I2C(0x4A) && !bno08x.begin_I2C(0x4B)) {
    Serial.println("BNO085 not found over I2C!");
    while (1) delay(10); 
  }

  bno08x.enableReport(SH2_GAME_ROTATION_VECTOR, 5000);
  
  pinMode(FSR_PIN, INPUT);
  pinMode(BTN_NEW_PAGE, INPUT_PULLUP);
  pinMode(BTN_PWR_TOGGLE, INPUT_PULLUP);
  analogReadResolution(12);

  // BLE Setup
  BLEDevice::init("SmartStrokes-Pen");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristic->addDescriptor(new BLE2902());
  pService->start();
  
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  BLEDevice::startAdvertising();
  
  Serial.println("BLE Advertising Started...");
}

void loop() {
  // Power Toggle Logic
  if (digitalRead(BTN_PWR_TOGGLE) == LOW && (millis() - lastBtnPress > 500)) {
    isPowerOn = !isPowerOn;
    lastBtnPress = millis();
  }

  if (!isPowerOn) return;
  if (!deviceConnected) return;

  // Sensor Event Handling
  if (bno08x.getSensorEvent(&sensorValue)) {
    if (sensorValue.sensorId == SH2_GAME_ROTATION_VECTOR) {
      if (millis() - lastSend >= sendInterval) {
        lastSend = millis();

        int newPageBtn = (digitalRead(BTN_NEW_PAGE) == LOW) ? 1 : 0;
        int fsrReading = analogRead(FSR_PIN);

        String json = "{\"r\":" + String(sensorValue.un.gameRotationVector.real, 4) +
                      ",\"i\":" + String(sensorValue.un.gameRotationVector.i, 4) +
                      ",\"j\":" + String(sensorValue.un.gameRotationVector.j, 4) +
                      ",\"k\":" + String(sensorValue.un.gameRotationVector.k, 4) +
                      ",\"p\":" + String(fsrReading) +
                      ",\"d\":" + String(fsrReading > 30) +
                      ",\"np\":" + String(newPageBtn) + "}";
        
        pCharacteristic->setValue(json.c_str());
        pCharacteristic->notify();
      }
    }
  }
}