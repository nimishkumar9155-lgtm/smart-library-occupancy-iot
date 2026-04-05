#include <WiFi.h>
#include <HTTPClient.h>

// ====== 1. WIFI SETTINGS ======
// Enter your Mobile Hotspot or Home Router details here
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ====== 2. FIREBASE SETTINGS ======
// Pre-configured for your exact Database!
const char* FIREBASE_URL = "https://library-seat-occupancy-tracker-default-rtdb.firebaseio.com/seats.json";

// ====== 3. SENSOR PINS ======
// We are setting up 8 seats (A1 to A8)
const int NUM_SEATS = 8;
const String SEAT_LABELS[NUM_SEATS] = {"A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"};

// The GPIO pins connected to the IR sensors for each seat
// Change these depending on where you plugged the jumper wires
const int SENSOR_PINS[NUM_SEATS] = {13, 12, 14, 27, 26, 25, 33, 32}; 

// Track previous states so we only send data when something CHANGES
int lastStates[NUM_SEATS];

void setup() {
  Serial.begin(115200);
  
  // Initialize all sensor pins as INPUT
  for (int i = 0; i < NUM_SEATS; i++) {
    pinMode(SENSOR_PINS[i], INPUT);
    lastStates[i] = -1; // Default starting value
  }

  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Loop through and check every single seat sensor
  for (int i = 0; i < NUM_SEATS; i++) {
    int currentState = digitalRead(SENSOR_PINS[i]);

    // If the state changed since the last check, update Firebase!
    // (We skip the very first read by checking if lastState != -1)
    if (currentState != lastStates[i]) {
      if (lastStates[i] != -1) {
        
        // IR sensors usually read LOW when an obstacle/person is detected
        String status = (currentState == LOW) ? "busy" : "free";
        
        Serial.println("Seat " + SEAT_LABELS[i] + " changed to: " + status);
        
        // Send the real-time update to your Firebase Database
        updateFirebase(SEAT_LABELS[i], status);
      }
      
      // Save the new state so we don't spam Firebase 
      lastStates[i] = currentState;
    }
  }
  
  delay(200); // 200ms delay to prevent reading physical bounces
}

// Function to push the update to your Firebase Realtime Database
void updateFirebase(String seatLabel, String status) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    // Connect to the Firebase Realtime DB URL
    http.begin(FIREBASE_URL);
    
    // Define the data type we are sending
    http.addHeader("Content-Type", "application/json");

    // Construct the JSON payload exactly what the website requires
    // Example format: {"A1":"busy"}
    String payload = "{\"" + seatLabel + "\":\"" + status + "\"}";

    // HTTP PATCH updates ONLY this exact seat label, without deleting other seats
    int httpResponseCode = http.PATCH(payload);

    if (httpResponseCode > 0) {
      Serial.println("➜ Firebase Update OK! Dashboard should flash now.");
    } else {
      Serial.println("➜ Firebase Error: " + http.errorToString(httpResponseCode));
    }
    
    // Close the connection to free memory
    http.end();
  } else {
    Serial.println("Error: WiFi Disconnected");
  }
}
