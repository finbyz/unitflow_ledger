# purchase_receipt.py
import frappe
from frappe.utils import nowtime, flt


def create_secondary_sle(doc, method):
    if doc.doctype != "Stock Entry":
        return

    for item in doc.items:
        if not (item.secondary_uom and item.secondary_qty):
            continue

        for warehouse, actual_qty in get_secondary_stock_movements(item):
            sle = frappe.new_doc("Secondary UOM Ledger Entry")
            sle.item_code = item.item_code
            sle.warehouse = warehouse
            sle.posting_date = doc.posting_date
            sle.posting_time = doc.posting_time or nowtime()
            sle.voucher_type = doc.doctype
            sle.voucher_no = doc.name
            sle.actual_qty = actual_qty
            sle.stock_uom = item.secondary_uom
            sle.company = doc.company
            sle.batch_no = getattr(item, "batch_no", None)
            sle.insert(ignore_permissions=True)
            sle.submit()


def get_secondary_stock_movements(item):
    qty = abs(flt(item.secondary_qty))
    if not qty:
        return []

    movements = []

    if item.s_warehouse:
        movements.append((item.s_warehouse, -qty))

    if item.t_warehouse:
        movements.append((item.t_warehouse, qty))

    # Fallback for unusual rows with no explicit source/target split.
    if not movements:
        warehouse = item.t_warehouse or item.s_warehouse
        if warehouse:
            movements.append((warehouse, qty))

    return movements


def calc_secondary_from_item(item, is_opening=False):

    if not item.item_code:
        return
    if frappe.utils.cint(item.get("manual_secondary_qty")):
        return

    item_doc = frappe.get_cached_doc("Item", item.item_code)

    primary_uom = item.stock_uom or item_doc.stock_uom

    secondary_row = next((u for u in item_doc.uoms if u.uom != primary_uom), None)

    if not secondary_row:
        return

    conversion_factor = flt(secondary_row.conversion_factor)

    # Always set the UOM and factor
    item.secondary_uom = secondary_row.uom
    item.secondary_conversion_factor = conversion_factor

    # Skip qty calculation for opening entries — qty is entered manually
    if not is_opening and conversion_factor:
        item.secondary_qty = flt(item.qty) / conversion_factor


def populate_secondary(doc, method):

    is_opening = doc.is_opening == "Yes"

    wo_map = {}

    if doc.work_order:

        wo_items = frappe.get_all(
            "Work Order Item",
            filters={"parent": doc.work_order},
            fields=["item_code", "secondary_uom", "secondary_qty", "required_qty"],
        )

        wo_map = {d.item_code: d for d in wo_items}

    for item in doc.items:
        if frappe.utils.cint(item.get("manual_secondary_qty")):
            continue

        wo_item = wo_map.get(item.item_code)

        if wo_item and wo_item.secondary_uom:

            # Always set the UOM
            item.secondary_uom = wo_item.secondary_uom

            # Skip qty calculation for opening entries
            if not is_opening:
                if flt(wo_item.required_qty):
                    ratio = flt(item.qty) / flt(wo_item.required_qty)
                    item.secondary_qty = flt(wo_item.secondary_qty) * ratio
                else:
                    item.secondary_qty = wo_item.secondary_qty

        else:
            calc_secondary_from_item(item, is_opening=is_opening)
