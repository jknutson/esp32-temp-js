load('api_adc.js');
load('api_config.js');
load('api_events.js');
load('api_gpio.js');
load('api_http.js');
load('api_net.js');
load('api_timer.js');
load('api_sys.js');
load('api_ds18b20.js');
load('api_lcd_i2c.js');
load('api_mqtt.js');

let deviceId = Cfg.get('device.id');
let deviceType = 'esp32';
let buttonPin = Cfg.get('pins.builtin');  // builtin
let voltagePin = Cfg.get('pins.voltage');
let pollInterval = Cfg.get('interval') * 1000;
let lcdAddr = 0x27;
let lcdNumRows = 4;
let lcdNumCols = 20;
// planning for future multi-sensor support
let tempSensorId = 'ds18b20';

let r1 = Cfg.get('pins.voltage_r1'); // r1 of voltage divider (ohm)
let r2 = Cfg.get('pins.voltage_r2'); // r2 of voltage divider (ohm)

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
lcd.print('starting up...')
print('lcd setup complete');
// lcd.setCursor(0, 1);
// lcd.print('second line');

print('deviceId:', deviceId)

let multiplyVoltage = function(rawVoltage, r1, r2) {
  return (rawVoltage * (r1 + r2) / r2);
};

GPIO.set_button_handler(buttonPin, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 50, function(x) {
  // builtin button pressed
  let res = MQTT.pub('esp32/' + deviceId + '/events/buttonPushed', buttonPin);
  print('MQTT Published (button pushed):', res ? 'yes' : 'no');
}null);

Timer.set(pollInterval, true, function() {
  let now = Timer.now();

  // read temperature
  let temperature = '???';
  if (DS18B20.connected()) {
    let t = DS18B20.get();
    if (isNaN(t)) {
      print('could not read from device: ' + t);
      break;
    } else {
      let t_f = (t * 1.8) + 32;
      print('temperature (c): ' + JSON.stringify(t));
      let res = MQTT.pub('esp32/' + deviceId + '/temperature/' + tempSensorId, JSON.stringify(t_f));
      print('MQTT Published (polled temperature):', res ? 'yes' : 'no');
      temperature = t_f;
    }
  } else {
    print('no oneWire device found')
  }

  // read voltage
  let voltage = '???';
  if (voltagePin !== "" && r1 > 0 && r2 > 0) {
    let adcReadVoltage = ffi('int mgos_adc_read_voltage(int)');
    voltage = adcReadVoltage(voltagePin);
    print('voltage: ', voltage);
    let res = MQTT.pub('esp32/' + deviceId + '/voltage/pin' + voltagePin, JSON.stringify(voltage));
    print('MQTT Published (polled voltage):', res ? 'yes' : 'no');
  }

  // redraw lcd
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print('v:' + JSON.stringify(voltage) + 'mV');
  lcd.setCursor(0, 1);
  lcd.print('t:'  + JSON.stringify(temperature) + 'F');
}, null);
