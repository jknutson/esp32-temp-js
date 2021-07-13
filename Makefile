MOS=mos

.PHONY: all build flash configure reboot

build:
	$(MOS) build --platform esp32

flash:
	$(MOS) flash

wifi:
	$(MOS) wifi "${WIFI_SSID}" "${WIFI_PASS}"

wifi-nsm2:
	$(MOS) wifi "nsm2" "${WIFI_PASS}"

configure-datadog:
	$(MOS) put combined.pem ca.pem
	$(MOS) config-set datadog.api_key="${DD_API_KEY}" \
		datadog.host_name="${DD_HOSTNAME}" \

configure-voltage:
	$(MOS) config-set pins.voltage="${PIN_VOLTAGE}" \
		pins.voltage_r1="${PIN_VOLTAGE_R1}" \
		pins.voltage_r2="${PIN_VOLTAGE_R2}" \


configure-i2c:
	$(MOS) config-set i2c.sda_gpio="${PIN_I2C_SDA}" \
		i2c.scl_gpio="${PIN_I2C_SCL}"

configure-mdash:
	 $(MOS) config-set dash.enable=true dash.token="${MDASH_TOKEN}"

configure-mqtt:
	$(MOS) config-set mqtt.enable=true mqtt.server=192.168.2.6

reboot:
	$(MOS) call Sys.Reboot

all: build flash wifi configure reboot
all-solar: build flash wifi-nsm2 configure configure-voltage configure-i2c configure-mdash reboot

configure-compost: wifi-nsm2 configure configure-mdash
all-compost: build flash configure-compost reboot
