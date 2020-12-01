#include "mgos.h"
#include "mgos_mdash_api.h"
#include "mjs.h"

void create_mdash_ui() {
  struct mgos_mdash_widgets *widgets;
  if (mgos_mdash_widgets_create_from_config(&widgets)) {
    mgos_mdash_create_ui(widgets);
  }
  mgos_mdash_widgets_free(widgets);
}
