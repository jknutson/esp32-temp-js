# esp32-temp-js

This is a JS application which runs on an ESP32 device with Mongoose OS.

It will read a DS18B20 one-wire temperature sensor and emit the reading to Datadog.

## Super Basic Setup

```sh
mos wifi SSID PASS
mos put combined-ca.pem ca.pem
mos config-set datadog.api_key=API_KEY
```

or

```sh
cp .env.example .env.local
# place appropriate values in .env.local
make configure
```

then

```sh
mos call Sys.Reboot
```

## Advanced/Thorough Setup

1. Copy the example .env file to a new file **with the `.local` suffix**
  - The `.local` suffix helps prevent the file (and it's secret contents) from being committed to git
    ```sh
    cp .env.example .env.project.local  # .local suffix is important, we will store secrets in this file
    ```
2. Edit the file, placing in appropriate values for your environment
3. Source the file, and run the relevant make target
   ```sh
   source .env.project.local
   make all
   ```
