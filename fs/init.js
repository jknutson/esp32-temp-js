load('api_adc.js');
load('api_config.js');
load('api_events.js');
load('api_gpio.js');
load('api_http.js');
load('api_net.js');
load('api_timer.js');
load('api_sys.js');
// load('api_ds18b20.js');
load('api_arduino_onewire.js');
load('api_lcd_i2c.js');
load('api_mqtt.js');
load('ds18b20.js');

let deviceId = Cfg.get('device.id');
let deviceType = 'esp32';
let buttonPin = Cfg.get('pins.builtin');  // builtin
let voltagePin = Cfg.get('pins.voltage');
let pollInterval = Cfg.get('interval') * 1000;
let lcdAddr = 0x27;
let lcdNumRows = 4;
let lcdNumCols = 20;

let r1 = Cfg.get('pins.voltage_r1'); // r1 of voltage divider (ohm)
let r2 = Cfg.get('pins.voltage_r2'); // r2 of voltage divider (ohm)

// setup onewire/ds18b20
// Initialize OneWire library
let ow = OneWire.create(33 /* pin */);  // TODO: get from Cfg

let adcReadVoltage = ffi('int mgos_adc_read_voltage(int)');

// Number of sensors found on the 1-Wire bus
let n = 0;
// Sensors addresses
let rom = ['01234567'];

// Search for sensors
let searchSens = function() {
  let i = 0;
  // Setup the search to find the device type on the next call
  // to search() if it is present.
  ow.target_search(DEVICE_FAMILY.DS18B20);

  while (ow.search(rom[i], 0/* Normal search mode */) === 1) {
    // If no devices of the desired family are currently on the bus, 
    // then another type will be found. We should check it.
    if (rom[i][0].charCodeAt(0) !== DEVICE_FAMILY.DS18B20) {
      break;
    }
    // Sensor found
    print('Sensor#', i, 'address:', toHexStr(rom[i]));
    rom[++i] = '01234567';
  }
  return i;
};

if (voltagePin !== "" && r1 > 0 && r2 > 0) {
  print('voltage reading enabled');
  ADC.enable(voltagePin);
}

// setup mqtt last will
Cfg.set({mqtt: {will_topic: 'esp32/' + deviceId + '/status', will_message: 'mqtt last will message'}});

// setup LCD
print('setting up lcd');
let lcd = LCD_I2C.create(lcdAddr);
lcd.begin(lcdNumRows, lcdNumCols);
lcd.clear();
lcd.setCursor(0, 0);
lcd.print('starting up...');
print('lcd setup complete');
// lcd.setCursor(0, 1);
// lcd.print('second line');

print('deviceId:', deviceId);

let multiplyVoltage = function(rawVoltage, r1, r2) {
  return (rawVoltage * (r1 + r2) / r2);
};

GPIO.set_button_handler(buttonPin, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 50, function(x) {
  // builtin button pressed
  let res = MQTT.pub('esp32/' + deviceId + '/events/buttonPushed', buttonPin);
  print('MQTT Published (button pushed):', res ? 'yes' : 'no');
}, null);

Timer.set(pollInterval, true, function() {
  let now = Timer.now();

  // TODO: use sample library, collect a number of frequent samples and emit min, max, mean, etc.

  // read temperature
  let temperature = '???';
  if (n === 0) {
    if ((n = searchSens()) === 0) {
      print('no DS18B20 device(s) found');
    }
  }
  for (let i = 0; i < n; i++) {
    let t = getTemp(ow, rom[i]);
    let tempSensorId = toHexStr(rom[i]);
    if (isNaN(t)) {
      print('No device found');
      break;
    } else {
      print('temperature (c): ' + JSON.stringify(t));
      let t_f = (t * 1.8) + 32;
      print('temperature (f): ' + JSON.stringify(t_f));
      let topic = 'esp32/' + deviceId + '/temperature/' + tempSensorId;
      print('topic: ', topic);
      let res = MQTT.pub(topic, JSON.stringify(t_f));
      print('MQTT Published (polled temperature):', res ? 'yes' : 'no');
      temperature = t_f;
    }
  }

  // read voltage
  let voltage = '???';
  if (voltagePin !== "" && r1 > 0 && r2 > 0) {
    voltage = adcReadVoltage(voltagePin);
    print('raw voltage: ', voltage, 'mV');
    let realVoltage = multiplyVoltage(voltage, r1, r2);
    print('real voltage: ', realVoltage, 'mV');
    let topic = 'esp32/' + deviceId + '/voltage/pin' + JSON.stringify(voltagePin);
    print('topic: ', topic);
    let res = MQTT.pub(topic, JSON.stringify(realVoltage));
    print('MQTT Published (polled voltage):', res ? 'yes' : 'no');
  }

  // redraw lcd
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print('v:' + JSON.stringify(voltage) + 'mV');
  lcd.setCursor(0, 1);
  lcd.print('t:'  + JSON.stringify(temperature) + 'F');
}, null);
