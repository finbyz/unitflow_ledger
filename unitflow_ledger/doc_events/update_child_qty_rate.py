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
    """Override to also persist secondary_qty, secondary_uom, secondary_conversion_factor
    and recalculate all pricing, discount and taxes like standard ERPNext."""

    # Run standard ERPNext update first
    _original_update_child_qty_rate(
        parent_doctype, trans_items, parent_doctype_name, child_docname
    )

    # Only run custom logic for Sales Order
    if parent_doctype != "Sales Order":
        return

    data = json.loads(trans_items) if isinstance(trans_items, str) else trans_items

    parent = frappe.get_doc(parent_doctype, parent_doctype_name)

    for d in data:
        if not d.get("docname") and not d.get("item_code"):
            continue

        docname = d.get("docname")
        item_code = d.get("item_code")

        child_item = None

        if docname:
            child_item = frappe.get_doc("Sales Order Item", docname)
        else:
            parent.reload()
            for item in parent.get(child_docname):
                if item.item_code == item_code and not item.secondary_uom:
                    child_item = item
                    break

        if not child_item:
            continue
        secondary_uom = d.get("secondary_uom") or ""
        secondary_conversion_factor = flt(d.get("secondary_conversion_factor") or 0)
        secondary_qty = flt(d.get("secondary_qty") or 0)

        qty = flt(d.get("qty") or 0)
        rate = flt(d.get("rate") or 0)
        price_list_rate = flt(d.get("price_list_rate") or 0)
        discount_percentage = flt(d.get("discount_percentage") or 0)

        # secondary_uom = d.get("secondary_uom") or ""
        # secondary_conversion_factor = flt(d.get("secondary_conversion_factor") or 0)
        # qty = flt(d.get("qty") or 0)

        # Calculate secondary qty
        if secondary_conversion_factor:
            secondary_qty = qty / secondary_conversion_factor
        else:
            secondary_qty = 0

        child_item.flags.ignore_validate_update_after_submit = True

        child_item.qty = qty
        child_item.rate = rate
        child_item.price_list_rate = price_list_rate
        child_item.discount_percentage = discount_percentage

        child_item.secondary_uom = secondary_uom
        child_item.secondary_conversion_factor = secondary_conversion_factor
        child_item.secondary_qty = secondary_qty

        child_item.save()

    # ------------------------------
    # Recalculate ERPNext pricing
    # ------------------------------

    parent.reload()

    # runs price rules, rates etc
    parent.set_missing_values()

    # recalculates discount, taxes, totals
    parent.calculate_taxes_and_totals()

    parent.flags.ignore_validate_update_after_submit = True
    parent.save()