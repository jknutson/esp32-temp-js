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

let deviceId = Cfg.get('device.id');
let deviceType = 'esp32';
let metricTags = ['device:' + deviceId, 'deviceType:' + deviceType];
let buttonPin = Cfg.get('pins.builtin');  // builtin
let voltagePin = Cfg.get('pins.voltage');
let pollInterval = Cfg.get('interval') * 1000;
let datadogApiKey = Cfg.get('datadog.api_key');
let datadogHostName = Cfg.get('datadog.host_name');
let lcdAddr = 0x27;
let lcdNumRows = 4;
let lcdNumCols = 20;

let r1 = Cfg.get('pins.voltage_r1'); // r1 of voltage divider (ohm)
let r2 = Cfg.get('pins.voltage_r2'); // r2 of voltage divider (ohm)

if (voltagePin !== "" && r1 > 0 && r2 > 0) {
  print('voltage reading enabled');
  ADC.enable(voltagePin);
}

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

let postMetric = function(datadogApiKey, payload) {
  print('publishing: ' + JSON.stringify(payload))
  HTTP.query({
    url: 'https://api.datadoghq.com/api/v1/series?api_key=' + datadogApiKey,
    data: payload,
    success: function(body, full_http_msg) {
      print('datadog post metric success:', body);
    },
    error: function(err) {
      print('datadog post metric error:', err);
    }
  });
};

let multiplyVoltage = function(rawVoltage, r1, r2) {
  return (rawVoltage * (r1 + r2) / r2);
};

GPIO.set_button_handler(buttonPin, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 50, function(x) {
  let buttonPinString = JSON.stringify(buttonPin);
  // TODO: list sensors and include in event payload, plus any other debugging info?
  let payload = JSON.stringify({
    text: 'button on pin ' + buttonPinString + ' was pressed',
    title: 'esp32 device button pressed',
    host: datadogHostName,
    tags: [
      'device:' + deviceId,
      'deviceType:' + deviceType,
      'buttonPin:' + buttonPinString
    ]
  });

  HTTP.query({
    url: 'https://api.datadoghq.com/api/v1/events?api_key=' + datadogApiKey,
    data: payload,
    success: function(body, full_http_msg) {
      print('datadog post event success:', body);
    },
    error: function(err) {
      print('datadog post event error:', err);
    }
  });
}, null);


Timer.set(pollInterval, true, function() {
  let now = Timer.now();

  // read system stats
  let totalRam = Sys.total_ram();
  let freeRam = Sys.free_ram();
  let sysPayload = {
    series: [
      {
        metric: 'mos.sys.total_ram',
        points: [[now, totalRam]],
        host: datadogHostName,
        tags: metricTags,
        type: 'gauge'
      },
      {
        metric: 'mos.sys.free_ram',
        points: [[now, freeRam]],
        host: datadogHostName,
        tags: metricTags,
        type: 'gauge'
      }
    ]
  };
  print('publishing: ' + JSON.stringify(sysPayload))
  postMetric(datadogApiKey, sysPayload);

  // read temperature
  let temperature = '???';
  if (DS18B20.connected()) {
    let t = DS18B20.get();
    if (isNaN(t)) {
      print('could not read from device: ' + t);
      break;
    } else {
      let payload = {
        series: [
          {
            metric: 'w1_temperature.celcius.gauge',
            points: [[Timer.now(), t]],
            host: datadogHostName,
            tags: metricTags,
            type: 'gauge'
          }
        ]
      };
      print('publishing: ' + JSON.stringify(payload))
      postMetric(datadogApiKey, payload);
      temperature = t;
    }
  } else {
    print('no oneWire device found')
  }

  let voltage = '???';

  if (voltagePin !== "" && r1 > 0 && r2 > 0) {
    // read voltage
    let adcReadVoltage = ffi('int mgos_adc_read_voltage(int)');
    voltage = adcReadVoltage(voltagePin);
    print('voltage: ', voltage);
    let voltagePayload = {
      series: [
        {
          metric: 'mos.voltage',
          points: [[now, multiplyVoltage(voltage, r1, r2)]],
          host: datadogHostName,
          tags: metricTags,
          type: 'gauge'
        }
      ]
    };
    print('publishing: ' + JSON.stringify(voltagePayload))
    postMetric(datadogApiKey, voltagePayload);
  }

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print('v:' + JSON.stringify(voltage) + 'mV');
  lcd.setCursor(0, 1);
  lcd.print('t:'  + JSON.stringify(temperature) + 'F');
}, null);
