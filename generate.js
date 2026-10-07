const fs = require('fs');

const categories = [
    { name: "Microcontrollers", img: "https://upload.wikimedia.org/wikipedia/commons/3/38/Arduino_Uno_-_R3.jpg" },
    { name: "Sensors", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/PIR_sensor.jpg/800px-PIR_sensor.jpg" },
    { name: "Modules", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Relay_module.jpg/800px-Relay_module.jpg" },
    { name: "Motors", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Servo_motor.jpg/800px-Servo_motor.jpg" },
    { name: "Displays", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/16x2_Character_LCD.jpg/800px-16x2_Character_LCD.jpg" },
    { name: "Resistors", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Resistors.jpg/800px-Resistors.jpg" },
    { name: "Capacitors", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Capacitors_of_various_sizes_and_types.jpg/800px-Capacitors_of_various_sizes_and_types.jpg" },
    { name: "LEDs & Lights", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/LEDs_various_sizes.jpg/800px-LEDs_various_sizes.jpg" },
    { name: "Power", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/9V_Battery.jpg/800px-9V_Battery.jpg" },
    { name: "Tools", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Soldering_iron.jpg/800px-Soldering_iron.jpg" },
    { name: "Cables & Wiring", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Jumper_wires.jpg/800px-Jumper_wires.jpg" }
];

const products = [];

function addProduct(title, category, price, img, rating = 4.5, isBestSeller = false) {
    products.push({
        title,
        category,
        price,
        rating,
        isBestSeller,
        image: img || categories.find(c => c.name === category).img
    });
}

// 1. Core Boards (12 items)
const boards = ['Arduino Uno R3', 'Arduino Mega 2560', 'Arduino Nano V3', 'Arduino Leonardo', 'Arduino Pro Mini', 'ESP32 DevKit V1', 'ESP8266 NodeMCU', 'Raspberry Pi 4 4GB', 'Raspberry Pi 3 B+', 'Raspberry Pi Pico', 'STM32 Blue Pill', 'Teensy 4.0'];
boards.forEach(b => addProduct(b, "Microcontrollers", Math.floor(Math.random()*400)+100, categories[0].img, 4.8, true));

// 2. Sensors (50 items)
const sensors = ['PIR Motion Sensor HC-SR501', 'Ultrasonic Sensor HC-SR04', 'DHT11 Temp/Humidity', 'DHT22 Temp/Humidity', 'MQ-2 Gas Sensor', 'MQ-7 CO Sensor', 'LDR Photoresistor Module', 'Soil Moisture Sensor', 'Water Level Sensor', 'Sound Sensor Module', 'IR Obstacle Avoidance', 'Flame Sensor', 'Heart Rate Pulse Sensor', 'GY-521 MPU6050 Gyro'];
for(let i=0; i<50; i++) {
    addProduct(sensors[i % sensors.length] + (i >= sensors.length ? ` (V${Math.floor(i/sensors.length)+1})` : ''), "Sensors", Math.floor(Math.random()*150)+30, categories[1].img);
}

// 3. Resistors (170 items)
const ohms = [10, 22, 47, 100, 220, 330, 470, '1k', '2.2k', '4.7k', '10k', '22k', '47k', '100k', '220k', '470k', '1M'];
const watts = ['1/4W', '1/2W', '1W', '2W', '5W'];
watts.forEach(w => {
    ohms.forEach(o => {
        addProduct(`Resistor ${o} Ohm ${w} (Pack of 10)`, "Resistors", 5, categories[5].img, 4.0);
        addProduct(`Resistor ${o} Ohm ${w} (Pack of 100)`, "Resistors", 30, categories[5].img, 4.5);
    });
});

// 4. Capacitors (80 items)
const caps = ['1uF', '2.2uF', '4.7uF', '10uF', '22uF', '47uF', '100uF', '220uF', '470uF', '1000uF'];
const volts = ['16V', '25V', '50V', '100V'];
volts.forEach(v => {
    caps.forEach(c => {
        addProduct(`Electrolytic Capacitor ${c} ${v} (Pack of 5)`, "Capacitors", 15, categories[6].img);
        addProduct(`Ceramic Capacitor ${c} ${v} (Pack of 10)`, "Capacitors", 10, categories[6].img);
    });
});

// 5. LEDs (36 items)
const colors = ['Red', 'Green', 'Blue', 'Yellow', 'White', 'RGB'];
const sizes = ['3mm', '5mm', '10mm', 'SMD 0805', 'SMD 1206', 'Strip 5m'];
colors.forEach(c => {
    sizes.forEach(s => {
        addProduct(`${c} LED ${s} (Pack of 10)`, "LEDs & Lights", s.includes('Strip') ? 150 : 10, categories[7].img, 4.7, c === 'Red' && s === '5mm');
    });
});

// 6. Motors & Modules & Extras (120 items)
for(let i=1; i<=30; i++) addProduct(`Servo Motor SG90 / MG995 Variant ${i}`, "Motors", 80 + i, categories[3].img);
for(let i=1; i<=30; i++) addProduct(`Relay Module ${i%4 + 1}-Channel 5V`, "Modules", 40 + i*10, categories[2].img);
for(let i=1; i<=20; i++) addProduct(`OLED Display 0.96 inch I2C (${i}x)`, "Displays", 120, categories[4].img, 4.9, true);
for(let i=1; i<=20; i++) addProduct(`Jumper Wires M-M / M-F / F-F (40pcs) Pack ${i}`, "Cables & Wiring", 45, categories[10].img);
for(let i=1; i<=20; i++) addProduct(`Soldering Iron 60W Kit V${i}`, "Tools", 250, categories[9].img);

// 7. ICs (50 items)
const icImage = "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/DIP_IC.jpg/800px-DIP_IC.jpg";
for(let i=1; i<=50; i++) addProduct(`Integrated Circuit IC 555 / 74HC Variant ${i}`, "Modules", 15, icImage);

fs.writeFileSync('generated_products.json', JSON.stringify(products, null, 2));
console.log('Total products generated: ' + products.length);
