load('api_adc.js');
load('api_arduino_onewire.js');
load('api_config.js');
load('api_gpio.js');
load('api_lcd_i2c.js');
load('api_mqtt.js');
load('api_timer.js');
load('ds18b20.js');

let deviceId = Cfg.get('device.id');
print('deviceId:', deviceId);
let buttonPin = Cfg.get('pins.builtin');
let voltagePin = Cfg.get('pins.voltage');
let ds18b20Pin = Cfg.get('pins.ds18b20');
let pollInterval = Cfg.get('interval') * 1000;
let lcdAddr = 0x27;
let lcdNumRows = 4;
let lcdNumCols = 20;
// planning for future multi-sensor support
let tempSensorId = 'ds18b20';

// MQTT
let mqTopicBase = 'iot/' + deviceId;
Cfg.set({mqtt: {will_topic: mqTopicBase + '/status', will_message: 'mqtt last will message'}});

// voltage reading
let adcReadVoltage = ffi('int mgos_adc_read_voltage(int)');
let r1 = Cfg.get('pins.voltage_r1'); // r1 of voltage divider (ohm)
let r2 = Cfg.get('pins.voltage_r2'); // r2 of voltage divider (ohm)
if (voltagePin !== "" && r1 > 0 && r2 > 0) {
  print('voltage reading enabled');
  ADC.enable(voltagePin);
}
let multiplyVoltage = function(rawVoltage, r1, r2) {
  return (rawVoltage * (r1 + r2) / r2);
};

// onewire/ds18b20
let ow = OneWire.create(ds18b20Pin);
let n = 0;
let rom = ['01234567'];
let searchSens = function() {
  let i = 0;
  ow.target_search(DEVICE_FAMILY.DS18B20);

  while (ow.search(rom[i], 0/* Normal search mode */) === 1) {
    if (rom[i][0].charCodeAt(0) !== DEVICE_FAMILY.DS18B20) {
      break;
    }
    // Sensor found
    print('Sensor#', i, 'address:', toHexStr(rom[i]));
    rom[++i] = '01234567';
  }
  return i;
};

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

GPIO.set_button_handler(buttonPin, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 50, function(x) {
  // builtin button pressed
  let res = MQTT.pub(mqTopicBase + '/events/buttonPushed', buttonPin);
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
      let t_f = (t * 1.8) + 32;
      print('temperature (c): ' + JSON.stringify(t));
      let res = MQTT.pub(mqTopicBase + '/temperature/' + tempSensorId, JSON.stringify(t_f));
      print('MQTT Published (polled temperature):', res ? 'yes' : 'no');
      temperature = t_f;
    }
  }

  // read voltage
  let voltage = '???';
  if (voltagePin !== "" && r1 > 0 && r2 > 0) {
    let adcReadVoltage = ffi('int mgos_adc_read_voltage(int)');
    voltage = adcReadVoltage(voltagePin);
    print('voltage: ', voltage);
    let res = MQTT.pub(mqTopicBase + '/voltage/pin' + voltagePin, JSON.stringify(voltage));
    print('MQTT Published (polled voltage):', res ? 'yes' : 'no');
  }

  // redraw lcd
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print('v:' + JSON.stringify(voltage) + 'mV');
  lcd.setCursor(0, 1);
  lcd.print('t:'  + JSON.stringify(temperature) + 'F');
}, null);
