load('api_adc.js');
load('api_config.js');
load('api_timer.js');
load('api_arduino_onewire.js');
load('api_mqtt.js');
load('ds18b20.js');

let deviceId = Cfg.get('device.id');
print('deviceId:', deviceId);
let deviceType = 'esp32';
let buttonPin = Cfg.get('pins.builtin');  // builtin
let voltagePin = Cfg.get('pins.voltage');
let ds18b20Pin = Cfg.get('pins.ds18b20');
let pollInterval = Cfg.get('interval') * 1000;

let r1 = Cfg.get('pins.voltage_r1'); // r1 of voltage divider (ohm)
let r2 = Cfg.get('pins.voltage_r2'); // r2 of voltage divider (ohm)
let adcReadVoltage = ffi('int mgos_adc_read_voltage(int)');
let multiplyVoltage = function(rawVoltage, r1, r2) {
  return (rawVoltage * (r1 + r2) / r2);
};
if (voltagePin !== "" && r1 > 0 && r2 > 0) {
  print('voltage reading enabled');
  ADC.enable(voltagePin);
}

// setup onewire/ds18b20
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
      let topic = 'esp32/' + deviceId + '-' + tempSensorId + '/temperature';
      print('MQTT topic: ', topic);
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
    let topic = 'esp32/' + deviceId + '/voltage';
    print('topic: ', topic);
    let res = MQTT.pub(topic, JSON.stringify(realVoltage));
    print('MQTT Published (polled voltage):', res ? 'yes' : 'no');
  }
}, null);
