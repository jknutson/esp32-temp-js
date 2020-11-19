load('api_adc.js');
load('api_arduino_onewire.js');
load('api_config.js');
load('api_events.js');
load('api_gpio.js');
load('api_http.js');
load('api_net.js');
load('api_timer.js');
load('api_sys.js');
load('api_ds18b20.js');

let deviceId = Cfg.get('device.id');
let deviceType = 'esp32';
let metricTags = ['device:' + deviceId, 'deviceType:' + deviceType];
let oneWirePin = Cfg.get('pins.temp');
let buttonPin = Cfg.get('pins.builtin');  // builtin
let voltagePin = Cfg.get('pins.voltage');
let pollInterval = Cfg.get('interval') * 1000;
let datadogApiKey = Cfg.get('datadog.api_key');
let datadogHostName = Cfg.get('datadog.host_name');

let r1 = 10000; // r1 of voltage divider (ohm)
let r2 = 2200; // r2 of voltage divider (ohm)

let ow = OneWire.create(oneWirePin);
let n = 0;
let rom = ['01234567'];

if (voltagePin != "") {
  print('voltagePin set, voltage reading enabled');
  ADC.enable(voltagePin);
}

print('deviceId:', deviceId)
print('oneWirePin:', oneWirePin)

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

let multiplyVoltage = function(rawVoltage) {
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
    }
  } else {
    print('no oneWire device found')
  }

  if (voltagePin != "") {
    // read voltage
    let adcReadVoltage = ffi('int mgos_adc_read_voltage(int)');
    let voltage = adcReadVoltage(voltagePin);
    print('voltage: ', voltage);
    let voltagePayload = {
      series: [
        {
          metric: 'mos.voltage',
          points: [[now, multiplyVoltage(voltage)]],
          host: datadogHostName,
          tags: metricTags,
          type: 'gauge'
        }
      ]
    };
    print('publishing: ' + JSON.stringify(voltagePayload))
    postMetric(datadogApiKey, voltagePayload);
  }
}, null);

Event.addGroupHandler(Net.STATUS_GOT_IP, function(ev, evdata, ud) {
  // char *mgos_net_ip_to_str(const struct sockaddr_in *sin, char *out);
  // let f = ffi('int my_func(int, int)');
  // print('Calling C my_func:', f(1,2));
  let gotIp =
  print('== Net event:', 'GOT_IP', ev, evdata, ud);
}, null);
