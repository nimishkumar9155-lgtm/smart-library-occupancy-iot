# ESP32 Integration Guide — Library Seat Tracker

This guide explains how to connect your ESP32 with IR/ultrasonic sensors to the Library Seat Tracker website so seat data appears in real-time on the dashboard.

---

## 📋 How It Works

```
┌──────────────┐       WiFi (HTTP)       ┌──────────────────────┐
│   ESP32      │  ───────────────────►   │  Dashboard Website   │
│  + Sensors   │   JSON seat data        │  (Browser)           │
└──────────────┘                         └──────────────────────┘
```

1. **ESP32** reads IR or ultrasonic sensors attached to each seat
2. ESP32 creates a **WiFi web server** on your local network
3. The **dashboard** (running in a browser on the same WiFi) **polls** the ESP32 every 3 seconds
4. The dashboard updates the seat grid, stats, and chart in real-time

---

## 🔧 Hardware You Need

| Component              | Quantity               | Purpose                    |
|------------------------|------------------------|----------------------------|
| ESP32 DevKit           | 1                      | Main controller            |
| IR Obstacle Sensors    | 1 per seat (e.g. 8)   | Detect if seat is occupied |
| Jumper Wires           | As needed              | Wiring                     |
| Breadboard             | 1                      | Prototyping                |
| USB Cable              | 1                      | Power + programming        |

### Alternative: Ultrasonic Sensor (HC-SR04)
You can use ultrasonic sensors instead of IR sensors. The code below supports both.

---

## ⚡ Wiring Diagram

```
ESP32 Pin Connections:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sensor 1 (Seat A1) → GPIO 13
Sensor 2 (Seat A2) → GPIO 12
Sensor 3 (Seat A3) → GPIO 14
Sensor 4 (Seat A4) → GPIO 27
Sensor 5 (Seat A5) → GPIO 26
Sensor 6 (Seat A6) → GPIO 25
Sensor 7 (Seat A7) → GPIO 33
Sensor 8 (Seat A8) → GPIO 32
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All sensor VCC → 3.3V
All sensor GND → GND
```

> **Tip:** If you have more than 8 sensors, use a multiplexer (CD74HC4067) or connect to additional GPIO pins.

---

## 💻 Arduino Code for ESP32

Upload this sketch to your ESP32 using the Arduino IDE.

### Step 1: Install the Arduino IDE
- Download from https://www.arduino.cc/en/software
- Add ESP32 board: Go to **File → Preferences → Additional Board URLs** and add:
  ```
  https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
  ```
- Go to **Tools → Board Manager**, search "ESP32", and install it

### Step 2: Upload This Code

```cpp
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>  // Install via Library Manager

// ====== CONFIGURATION - CHANGE THESE ======
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Sensor pins for each seat
const int SENSOR_PINS[] = {13, 12, 14, 27, 26, 25, 33, 32};
const char* SEAT_LABELS[] = {"A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"};
const int NUM_SEATS = 8;

// IR sensor: LOW = obstacle detected (seat occupied)
// Change to HIGH if your sensor works the other way
const int OCCUPIED_SIGNAL = LOW;
// ==========================================

WebServer server(80);

void setup() {
  Serial.begin(115200);

  // Initialize sensor pins
  for (int i = 0; i < NUM_SEATS; i++) {
    pinMode(SENSOR_PINS[i], INPUT);
  }

  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connected! IP Address: ");
  Serial.println(WiFi.localIP());

  // Setup HTTP endpoints
  server.on("/seats", HTTP_GET, handleGetSeats);
  server.on("/", HTTP_GET, handleRoot);

  // Enable CORS so the browser dashboard can fetch data
  server.enableCORS(true);

  server.begin();
  Serial.println("HTTP Server started!");
  Serial.println("Open your dashboard and call:");
  Serial.print("  startESP32Polling('");
  Serial.print(WiFi.localIP());
  Serial.println("')");
}

void loop() {
  server.handleClient();
}

// Returns seat data as JSON
void handleGetSeats() {
  StaticJsonDocument<1024> doc;
  JsonArray seatsArray = doc.createNestedArray("seats");

  for (int i = 0; i < NUM_SEATS; i++) {
    int sensorValue = digitalRead(SENSOR_PINS[i]);
    JsonObject seat = seatsArray.createNestedObject();
    seat["label"] = SEAT_LABELS[i];
    seat["status"] = (sensorValue == OCCUPIED_SIGNAL) ? "occupied" : "available";
  }

  String response;
  serializeJson(doc, response);

  server.send(200, "application/json", response);
}

// Simple status page
void handleRoot() {
  String html = "<html><body>";
  html += "<h1>Library Seat Tracker - ESP32</h1>";
  html += "<p>GET /seats for JSON data</p>";
  html += "<h2>Current Status:</h2><ul>";

  for (int i = 0; i < NUM_SEATS; i++) {
    int val = digitalRead(SENSOR_PINS[i]);
    html += "<li>" + String(SEAT_LABELS[i]) + ": ";
    html += (val == OCCUPIED_SIGNAL) ? "OCCUPIED" : "AVAILABLE";
    html += "</li>";
  }

  html += "</ul></body></html>";
  server.send(200, "text/html", html);
}
```

### Step 3: Install Required Library
- In Arduino IDE: **Sketch → Include Library → Manage Libraries**
- Search for **ArduinoJson** by Benoit Blanchon → Install it

### Step 4: Upload & Test
1. Select **Tools → Board → ESP32 Dev Module**
2. Select the correct **COM port**
3. Click **Upload**
4. Open **Serial Monitor** (115200 baud) to see the ESP32's IP address

---

## 🌐 Connecting ESP32 to the Dashboard

Once the ESP32 is running and connected to WiFi:

### Method 1: Browser Console (Quick Test)
1. Open `dashboard.html` in your browser
2. Press **F12** to open Developer Tools → **Console** tab
3. Type this command (replace with your ESP32's IP):
   ```javascript
   startESP32Polling('192.168.1.100')
   ```
4. The dashboard will start fetching real data from ESP32!

### Method 2: Auto-Connect (Permanent)
Edit `dashboard.html` and change the boot script at the bottom:

```html
<script>
  document.addEventListener('DOMContentLoaded', function() {
    renderDashboard();
    // Replace demo mode with ESP32 live data:
    startESP32Polling('192.168.1.100');  // ← Your ESP32 IP
  });
</script>
```

---

## 📡 JSON Data Format

The ESP32 serves data at `http://<ESP32_IP>/seats` in this format:

```json
{
  "seats": [
    { "label": "A1", "status": "available" },
    { "label": "A2", "status": "occupied" },
    { "label": "A3", "status": "available" },
    { "label": "A4", "status": "occupied" },
    { "label": "A5", "status": "available" },
    { "label": "A6", "status": "booked" },
    { "label": "A7", "status": "available" },
    { "label": "A8", "status": "occupied" }
  ]
}
```

Valid status values: `"available"`, `"occupied"`, `"booked"`

---

## 🔒 Important Notes

1. **Same WiFi Network**: The ESP32 and the computer running the dashboard must be on the **same WiFi network**
2. **CORS**: The ESP32 code includes CORS headers so the browser allows cross-origin requests
3. **Static IP (Recommended)**: To avoid the IP changing, set a static IP in the ESP32 code:
   ```cpp
   IPAddress local_IP(192, 168, 1, 200);
   IPAddress gateway(192, 168, 1, 1);
   IPAddress subnet(255, 255, 255, 0);
   WiFi.config(local_IP, gateway, subnet);
   ```
4. **Scaling**: For more seats, add more sensor pins and update the arrays
5. **Booking Support**: To support "booked" status, you'd need a separate booking system (e.g., Firebase) that the ESP32 or dashboard queries

---

## 🚀 Advanced: Using Firebase (Cloud Backend)

For a production setup where the dashboard works from anywhere (not just local WiFi):

1. Create a free Firebase project at https://firebase.google.com
2. ESP32 sends data to Firebase Realtime Database via HTTPS
3. Dashboard reads from Firebase using the Firebase JS SDK
4. This allows real-time sync across any device, anywhere

This is optional and more complex — the local WiFi approach above works great for a college project!
