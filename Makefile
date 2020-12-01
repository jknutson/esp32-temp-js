MOS=mos

.PHONY: all build flash configure reboot

build:
	$(MOS) build

flash:
	$(MOS) flash

wifi:
	$(MOS) wifi "${WIFI_SSID}" "${WIFI_PASS}"

wifi-nsm2:
	$(MOS) wifi "nsm2" "${WIFI_PASS}"

configure:
	$(MOS) put combined.pem ca.pem
	$(MOS) config-set datadog.api_key="${DD_API_KEY}"
	$(MOS) config-set datadog.host_name="${DD_HOSTNAME}"
	$(MOS) config-set pins.voltage="${PIN_VOLTAGE}"
	$(MOS) config-set pins.voltage_r1="${PIN_VOLTAGE_R1}"
	$(MOS) config-set pins.voltage_r2="${PIN_VOLTAGE_R2}"
	$(MOS) config-set ds18b20.pin="${PIN_DS18B20}"

configure-i2c:
	$(MOS) config-set i2c.sda_gpio="${PIN_I2C_SDA}"
	$(MOS) config-set i2c.scl_gpio="${PIN_I2C_SCL}"

configure-mdash:
	 $(MOS) config-set dash.enable=true dash.token="${MDASH_TOKEN}"

reboot:
	$(MOS) call Sys.Reboot

all: build flash wifi configure reboot
all-solar: build flash wifi-nsm2 configure configure-i2c reboot
