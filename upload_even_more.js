const fs = require('fs');

const products = [];
function addProduct(title, category, price) {
    products.push({
        title, category, price, rating: 4.8, isBestSeller: Math.random() > 0.7,
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Electronic_components.jpg/800px-Electronic_components.jpg"
    });
}

// --- POWER SUPPLIES & BATTERIES ---
[
    '5V 3A Power Adapter', '5V 5A Metal Switching Power Supply', '5V 10A Metal Switching Power Supply',
    '12V 5A Power Adapter', '12V 10A Metal Switching Power Supply', '12V 20A Metal Switching Power Supply', '12V 30A Metal Switching Power Supply',
    '24V 5A Metal Switching Power Supply', '24V 10A Metal Switching Power Supply',
    'Bench Power Supply 30V 5A Adjustable', 'ATX Power Supply Breakout Board',
    'Breadboard Power Supply Module MB102',
    'XL4015 5A Step Down Buck Converter with LED Display', 'XL6009 Step Up Boost Converter',
    'USB-C PD Trigger Decoy Module (5V/9V/12V/15V/20V)', 'Wireless Power Charger Transmitter + Receiver Module',
    '1S 18650 Battery BMS 3.7V', '2S 18650 Battery BMS 7.4V', '3S 18650 Battery BMS 11.1V 25A', '4S 18650 Battery BMS 14.8V 30A',
    'LiPo Battery 3.7V 500mAh', 'LiPo Battery 3.7V 1000mAh', 'LiPo Battery 3.7V 2200mAh',
    '9V Battery (Heavy Duty)', 'AA Battery (Pack of 4)', 'AAA Battery (Pack of 4)',
    '2x AA Battery Holder with Switch', '4x AA Battery Holder', '9V Battery Snap with DC Jack'
].forEach(n => addProduct(n, 'Power', Math.floor(Math.random() * 200) + 50));

// --- MOTORS, ACTUATORS & PUMPS ---
[
    'Micro Servo SG90 9g', 'Metal Gear Servo MG996R', 'Metal Gear Servo MG995', 'Micro Metal Gear Servo SG92R',
    'Coreless DC Motor (Drone Motor) Pair', 'Vibration Motor (Coin Type) 3V', 
    'Linear Actuator 12V 50mm Stroke', 'Linear Actuator 12V 100mm Stroke',
    'Stepper Motor NEMA 23 2.8A', 'Encoder DC Gear Motor JGB37 (12V 100RPM)', 'Encoder DC Gear Motor JGA25 (12V 300RPM)',
    '12V Electric Solenoid Valve for Water 1/2 inch', '12V Electric Solenoid Door Lock',
    'Mini Air Pump / Vacuum Pump 6V', 'Mini Air Pump / Vacuum Pump 12V',
    'Cooling Fan 5V 40x40mm', 'Cooling Fan 12V 80x80mm', 'Cooling Fan 12V 120x120mm', 'Cooling Fan 24V 40x40mm'
].forEach(n => addProduct(n, 'Motors', Math.floor(Math.random() * 250) + 40));

// --- ADDITIONAL SENSORS ---
[
    'Water Flow Sensor YF-S201', 'Waterproof Ultrasonic Sensor JSN-SR04T', 'PIR Motion Sensor HC-SR501', 'Mini PIR Motion Sensor AM312',
    'Heart Rate & Pulse Oximeter Sensor MAX30102', 'EMG Muscle Sensor v3', 'UV Sensor Module GUVA-S12SD',
    'Sound Sensor Module (Microphone)', 'Infrared (IR) Transmitter Module', 'Infrared (IR) Receiver Module 38KHz',
    'Photoelectric Switch Infrared Obstacle Avoidance E18-D80NK', 'Non-Contact Liquid Level Sensor', 
    'Raindrop Sensor Module', 'Snow/Water Level Sensor Module', 'Color Sensor TCS34725', 'Gesture Sensor APDS-9960'
].forEach(n => addProduct(n, 'Sensors', Math.floor(Math.random() * 150) + 30));

// --- DISPLAYS & LEDS ---
[
    'OLED Display 0.96 inch I2C White', 'OLED Display 0.96 inch I2C Blue/Yellow',
    '1.8 inch SPI TFT LCD Display', '128x64 Graphic LCD ST7920',
    'WS2812B RGB LED Ring (16 Bit)', 'WS2812B RGB LED Ring (24 Bit)', 'WS2812B RGB LED Strip (1 Meter 60 LEDs)',
    'RGB LED Matrix HUB75 64x64', 'RGB LED Matrix HUB75 32x32', '5mm RGB LED Common Cathode (Pack of 10)'
].forEach(n => addProduct(n, 'Displays', Math.floor(Math.random() * 300) + 50));

// --- ICs & ELECTRONICS ---
[
    '74HC595 Shift Register IC (Pack of 10)', 'NE555 Timer IC (Pack of 10)', 
    'LM358 Operational Amplifier (Pack of 10)', 'LM324 Quad Op-Amp (Pack of 10)',
    'PC817 Optocoupler (Pack of 20)', 'L293D Motor Driver IC (Pack of 5)', 
    'ULN2003 Darlington Transistor Array IC (Pack of 10)', 'LM317 Adjustable Voltage Regulator (Pack of 10)'
].forEach(n => addProduct(n, 'Components', Math.floor(Math.random() * 50) + 20));

// --- TOOLS, HARDWARE & MISC ---
[
    'Digital Multimeter DT-830B', 'Auto-Ranging Digital Multimeter',
    'Wire Stripper and Cutter', 'Helping Hands Soldering Stand with Magnifier',
    'Soldering Iron 60W Adjustable Temperature', 'Solder Wire 0.8mm 50g Reel', 'Soldering Rosin Flux Paste',
    'Soldering Iron Tips Replacement (Pack of 5)', 'Desoldering Pump (Solder Sucker)', 'Desoldering Wick Braid',
    'Precision Tweezers Set (Anti-Static)', 
    'M2 Brass Standoff Spacers Assortment Box', 'M3 Brass Standoff Spacers Assortment Box', 'M3 Nylon Screws and Nuts Box',
    'Aluminum Heat Sink Kit for Raspberry Pi', 'Thermal Paste Syringe',
    'Kapton Tape (High Temperature Polyimide)', 'Enameled Copper Wire 0.1mm'
].forEach(n => addProduct(n, 'Tools', Math.floor(Math.random() * 200) + 50));

// Upload function
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
