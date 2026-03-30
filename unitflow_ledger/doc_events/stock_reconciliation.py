import frappe
from frappe.utils import flt

def on_update(doc, method):
    secondary_uom_calc(doc)

def before_save(doc, method):
    secondary_uom_calc(doc)

def secondary_uom_calc(doc):
    if not hasattr(doc, "items"):
        return

    for item in doc.items:
        if not item.item_code:
            item.secondary_uom = None
            item.conversion_factor = 0
            item.secondary_uom_qty = 0
            continue

        item_doc = frappe.get_cached_doc("Item", item.item_code)

        secondary_row = next((u for u in item_doc.uoms if u.uom != item_doc.stock_uom), None)

        if not secondary_row:
            item.secondary_uom = None
            item.conversion_factor = 0
            item.secondary_uom_qty = 0
            continue

        conversion_factor = flt(secondary_row.conversion_factor)
        quantity = flt(item.qty)

        item.secondary_uom = secondary_row.uom
        item.conversion_factor = conversion_factor
        # conversion_factor is in stock-uom terms, so secondary uom qty is qty / factor.
        item.secondary_uom_qty = quantity / conversion_factor if conversion_factor else 0
