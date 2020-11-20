MOS=mos

.PHONY: all build flash configure reboot

build:
	$(MOS) build

flash:
	$(MOS) flash

configure:
	$(MOS) wifi "${WIFI_SSID}" "${WIFI_PASS}"
	$(MOS) put combined.pem ca.pem
	$(MOS) config-set datadog.api_key="${DD_API_KEY}"
	$(MOS) config-set datadog.host_name="${DD_HOSTNAME}"
	$(MOS) config-set pins.voltage="${PIN_VOLTAGE}"
	$(MOS) config-set pins.voltage_r1="${PIN_VOLTAGE_R1}"
	$(MOS) config-set pins.voltage_r2="${PIN_VOLTAGE_R2}"
	$(MOS) config-set ds18b20.pin="${PIN_DS18B20}"

configure-i2c:
	$(MOS) config-set i2c.sda_gpio=26
	$(MOS) config-set i2c.sdl_gpio=25

reboot:
	$(MOS) call Sys.Reboot

all: build flash configure reboot
