const fs = require('fs');

const products = [];
function addProduct(title, category, price) {
    products.push({
        title, category, price, rating: 4.8, isBestSeller: Math.random() > 0.8,
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Electronic_components.jpg/800px-Electronic_components.jpg" 
    });
}

// 1. Boards & Microcontrollers
['Arduino Micro', 'Arduino Due', 'Arduino Nano Every', 'ESP32-CAM with OV2640 Camera', 'ATTiny85 Digispark USB', 'Raspberry Pi Zero W', 'Raspberry Pi 5 8GB', 'STM32 Black Pill', 'NodeMCU ESP8266 V3', 'Arduino Pro Micro (ATmega32U4)'].forEach(n => addProduct(n, 'Microcontrollers', 200));

// 2. Advanced Sensors
['BME280 Temp/Pressure/Humidity Sensor', 'BMP280 Barometric Pressure Sensor', 'MPU9250 9-DOF IMU', 'MPU6050 6-DOF Gyro/Accelerometer', 'VL53L0X Time of Flight Laser Ranging', 'RFID RC522 Reader Module + Tags', 'Fingerprint Sensor AS608', 'TCS3200 Color Sensor', 'MQ-135 Air Quality Sensor', 'MQ-3 Alcohol Sensor', 'MQ-9 Combustible Gas Sensor', 'DS18B20 Waterproof Temp Sensor', 'Hall Effect Magnetic Sensor A3144', 'Microswitch / Limit Switch', 'Load Cell 5kg + HX711 Amplifier', 'Load Cell 50kg', 'Current Sensor ACS712 20A', 'Voltage Sensor Module 25V', 'Vibration Sensor SW-420', 'Flame Sensor Module', 'Soil Moisture Sensor (Corrosion Resistant)'].forEach(n => addProduct(n, 'Sensors', 85));

// 3. Displays
['LCD 20x4 I2C Module', 'TFT LCD Display 2.4 inch Shield', 'TFT LCD Touch Screen 3.5 inch', 'E-Paper Display 2.9 inch SPI', 'LED Matrix MAX7219 8x8 Module', '7-Segment Display 4-Digit with TM1637', 'OLED Display 1.3 inch I2C', 'Nextion HMI Display 2.4 inch'].forEach(n => addProduct(n, 'Displays', 250));

// 4. Motors & Drivers
['L298N Dual H-Bridge Motor Driver', 'TB6612FNG Motor Driver', 'A4988 Stepper Motor Driver', 'DRV8825 Stepper Driver', 'NEMA 17 Stepper Motor 1.5A', '28BYJ-48 Stepper Motor + ULN2003 Driver', 'DC Gear Motor (TT Motor) with Wheel', 'Brushless Motor A2212 1000KV + 30A ESC', 'Mini Submersible Water Pump 5V', 'Peristaltic Pump 12V', 'L293D Motor Drive Shield'].forEach(n => addProduct(n, 'Motors', 120));

// 5. Power & Batteries
['18650 Lithium Battery 2600mAh', '18650 Battery Holder (1 Slot)', '18650 Battery Holder (2 Slots)', '18650 Battery Holder (4 Slots)', 'TP4056 Lithium Battery Charger Module (Type-C)', 'MT3608 DC-DC Boost Converter 2A', 'LM2596 DC-DC Buck Converter 3A', 'Mini Solar Panel 5V 1W', 'Solar Panel 12V 5W', '12V 2A Power Adapter', '5V 2A Power Adapter', '9V Battery Snap Connector', 'Boost Converter 5V to 12V USB Cable'].forEach(n => addProduct(n, 'Power', 60));

// 6. Comms & Wireless
['NRF24L01+ Wireless Transceiver Module', 'NRF24L01+ PA+LNA with Antenna (1000m)', 'Bluetooth Module HC-05 (Master/Slave)', 'Bluetooth Module HC-06 (Slave)', 'SIM800L GSM/GPRS Module', 'GPS Module NEO-6M with Antenna', 'LoRa SX1278 433MHz Module', 'ESP-01S WiFi Module'].forEach(n => addProduct(n, 'Modules', 130));

// 7. Misc Modules
['RTC DS3231 Real Time Clock', 'MicroSD Card Adapter Module', 'Audio Amplifier PAM8403 (2x3W)', 'DFPlayer Mini MP3 Player Module', 'Passive Buzzer Module', 'Active Buzzer Module', 'Joystick Module 2-Axis', 'Rotary Encoder Module KY-040', 'Membrane Keypad 4x4', 'Laser Emitter Module 5V', 'Photoresistor (LDR) Sensor Module'].forEach(n => addProduct(n, 'Modules', 45));

// 8. Basic Components & Prototyping
['Breadboard 830 Tie Points', 'Breadboard 400 Tie Points', 'Mini Breadboard 170 Points', 'PCB Perfboard 5x7cm (Double Sided)', 'PCB Perfboard 7x9cm (Double Sided)', 'Push Button Tactile Switch 6x6x5mm (Pack of 20)', 'Push Button Tactile Switch with Caps', 'Slide Switch SPDT (Pack of 10)', 'Toggle Switch Heavy Duty', 'Potentiometer 10k Ohm', 'Potentiometer 100k Ohm', 'Potentiometer Knob (Pack of 5)', '1N4148 Switching Diode (Pack of 50)', '1N4007 Rectifier Diode (Pack of 50)', 'Zener Diode 5.1V (Pack of 20)', '2N2222 NPN Transistor (Pack of 20)', 'BC547 NPN Transistor (Pack of 20)', 'TIP120 Darlington Transistor (Pack of 5)', 'IRFZ44N N-Channel MOSFET (Pack of 5)', 'L7805 Voltage Regulator 5V (Pack of 5)', 'Heat Shrink Tubing Assortment (100pcs)', 'Alligator Clips Test Leads (10pcs)', 'Male to Male Dupont Jumper Wires (40pin)', 'Male to Female Dupont Jumper Wires (40pin)', 'Female to Female Dupont Jumper Wires (40pin)'].forEach(n => addProduct(n, 'Components', 35));

// Add to Firestore
async function upload() {
    console.log(`Starting upload of ${products.length} products...`);
    let count = 0;
    for (let p of products) {
        const body = {
            fields: {
                title: { stringValue: p.title },
                category: { stringValue: p.category },
                price: { doubleValue: p.price },
                rating: { doubleValue: p.rating },
                isBestSeller: { booleanValue: p.isBestSeller },
                image: { stringValue: p.image }
            }
        };
        try {
            const res = await fetch("https://firestore.googleapis.com/v1/projects/arduinohubfinal/databases/(default)/documents/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            if (res.ok) count++;
        } catch (e) {
            console.error(e);
        }
        await new Promise(r => setTimeout(r, 20));
    }
    console.log(`Done! Successfully uploaded ${count} products.`);
}

upload();
