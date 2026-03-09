from frappe.utils import flt
import frappe


def on_update(doc, method):
    # For child table "required_items" (e.g. Production Plan)
    secondary_uom_calc(
        doc,
        child_table_field="required_items",
        qty_field="required_qty",
        primary_uom_field="stock_uom",
    )

    # For child table "items" (BOM, Sales Order, etc.)
    secondary_uom_calc(
        doc, child_table_field="items", qty_field="qty", primary_uom_field="uom"
    )


def before_save(doc, method):
    secondary_uom_calc(
        doc,
        child_table_field="required_items",
        qty_field="required_qty",
        primary_uom_field="stock_uom",
    )
    secondary_uom_calc(
        doc, child_table_field="items", qty_field="qty", primary_uom_field="uom"
    )


def secondary_uom_calc(doc, child_table_field, qty_field, primary_uom_field):
    if not hasattr(doc, child_table_field):
        return

    for item in getattr(doc, child_table_field):

        if not item.item_code:
            item.secondary_uom = None
            item.secondary_conversion_factor = 0
            item.secondary_qty = 0
            continue

        item_doc = frappe.get_cached_doc("Item", item.item_code)

        primary_uom = getattr(item, primary_uom_field, None) or item_doc.stock_uom

        if hasattr(item, "required_uom"):
            item.required_uom = primary_uom

        secondary_row = next((u for u in item_doc.uoms if u.uom != primary_uom), None)

        if not secondary_row:
            item.secondary_uom = None
            item.secondary_conversion_factor = 0
            item.secondary_qty = 0
            continue

        conversion_factor = flt(secondary_row.conversion_factor)
        quantity = flt(getattr(item, qty_field, 0))

        item.secondary_uom = secondary_row.uom
        item.secondary_conversion_factor = conversion_factor
        # conversion_factor is in stock-uom terms, so secondary qty is qty / factor.
        item.secondary_qty = quantity / conversion_factor if conversion_factor else 0
