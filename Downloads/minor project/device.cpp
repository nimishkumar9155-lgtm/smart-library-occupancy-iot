#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#define trigPin 5
#define echoPin 18

const char* ssid = "nimini";
const char* password = "87654321";

// Firebase URL for Seat A1
const char* firebaseURL = "https://library-seat-occupancy-tracker-default-rtdb.firebaseio.com/seats/A1.json";

long duration;
float distance;

bool lastState = false; // false = available, true = occupied
bool firstRun = true;

void sendToFirebase(String status) {
  if (WiFi.status() == WL_CONNECTED) {
    // Firebase uses HTTPS, so you MUST use WiFiClientSecure and bypass the SSL certificate
    WiFiClientSecure client;
    client.setInsecure(); 
    
    HTTPClient http;
    http.begin(client, firebaseURL); 
    http.addHeader("Content-Type", "application/json");

    // The REST API expects the data formatted as JSON. 
    String payload = "\"" + status + "\"";

    int httpResponseCode = http.PUT(payload);

    if (httpResponseCode == 200) {
      Serial.print("✅ Firebase updated (");
      Serial.print(status);
      Serial.println(") HTTP 200 OK");
    } else {
      Serial.print("❌ Firebase error: HTTP ");
      Serial.println(httpResponseCode);
      if (httpResponseCode == 401 || httpResponseCode == 403) {
        Serial.println("-> PERMISSION DENIED! Change Firebase Realtime DB Rules to true.");
      } else if (httpResponseCode == 404) {
        Serial.println("-> NOT FOUND! Your Firebase Database URL is completely wrong or the database hasn't been created yet!");
      } else if (httpResponseCode < 0) {
         Serial.println("-> CONNECTION FAILED! Please check WiFi or SSL.");
      }
    }
    http.end();
  } else {
    Serial.println("WiFi not connected!");
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  // Connect to WiFi
  Serial.print("Connecting to WiFi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nConnected!");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Trigger ultrasonic
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  duration = pulseIn(echoPin, HIGH);
  distance = duration * 0.034 / 2;

  // Determine current seat state
  bool currentState = (distance > 0 && distance <= 20);

  // Only update Firebase if the state changed, or if it's the first run
  if (currentState != lastState || firstRun) {
    if (currentState) {
      Serial.println("Seat A1 FULL -> Updating Firebase");
    } else {
      Serial.println("Seat A1 EMPTY -> Updating Firebase");
    }

    lastState = currentState;
    firstRun = false;

    String currentStatus = currentState ? "occupied" : "available";
    sendToFirebase(currentStatus);
  }

  delay(500); // Poll sensor twice a second
}