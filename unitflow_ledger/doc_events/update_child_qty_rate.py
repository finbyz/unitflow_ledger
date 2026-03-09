import json
import frappe
from frappe.utils import flt
from erpnext.controllers.accounts_controller import (
    update_child_qty_rate as _original_update_child_qty_rate,
)


@frappe.whitelist()
def update_child_qty_rate(
    parent_doctype, trans_items, parent_doctype_name, child_docname="items"
):
    """Override to also persist secondary_qty, secondary_uom, secondary_conversion_factor."""
    # Call the original ERPNext function first
    _original_update_child_qty_rate(
        parent_doctype, trans_items, parent_doctype_name, child_docname
    )

    # Only run secondary field update for Sales Order
    if parent_doctype != "Sales Order":
        return

    data = json.loads(trans_items) if isinstance(trans_items, str) else trans_items

    parent = frappe.get_doc(parent_doctype, parent_doctype_name)

    for d in data:
        if not d.get("docname") and not d.get("item_code"):
            continue

        docname = d.get("docname")
        item_code = d.get("item_code")

        # Find the child item
        child_item = None
        if docname:
            child_item = frappe.get_doc(parent_doctype + " Item", docname)
        else:
            # For newly added items, find by item_code in the freshly saved parent
            parent.reload()
            for item in parent.get(child_docname):
                if item.item_code == item_code and not item.secondary_uom:
                    child_item = item
                    break

        if not child_item:
            continue

        secondary_uom = d.get("secondary_uom") or ""
        secondary_conversion_factor = flt(d.get("secondary_conversion_factor") or 0)
        qty = flt(d.get("qty") or 0)

        # Auto-calculate secondary_qty if conversion factor is available
        if secondary_conversion_factor:
            secondary_qty = qty / secondary_conversion_factor
        elif secondary_uom:
            # Look up the conversion factor from the item
            item_doc = frappe.get_cached_doc("Item", item_code)
            sec_row = next((u for u in item_doc.uoms if u.uom == secondary_uom), None)
            if sec_row:
                secondary_conversion_factor = flt(sec_row.conversion_factor)
                secondary_qty = (
                    qty / secondary_conversion_factor
                    if secondary_conversion_factor
                    else 0
                )
            else:
                secondary_qty = 0
        else:
            # Derive secondary UOM from item definition
            item_doc = frappe.get_cached_doc("Item", item_code)
            primary_uom = d.get("uom") or child_item.uom
            sec_row = next((u for u in item_doc.uoms if u.uom != primary_uom), None)
            if sec_row:
                secondary_uom = sec_row.uom
                secondary_conversion_factor = flt(sec_row.conversion_factor)
                secondary_qty = (
                    qty / secondary_conversion_factor
                    if secondary_conversion_factor
                    else 0
                )
            else:
                secondary_qty = 0

        child_item.flags.ignore_validate_update_after_submit = True
        child_item.secondary_uom = secondary_uom
        child_item.secondary_conversion_factor = secondary_conversion_factor
        child_item.secondary_qty = secondary_qty
        child_item.save()
