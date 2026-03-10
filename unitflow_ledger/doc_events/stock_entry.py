# purchase_receipt.py
import frappe
from frappe.utils import nowtime, flt

def create_secondary_sle(doc, method):
   #  Run only for Material Receipt
    if doc.doctype != "Stock Entry" or doc.stock_entry_type != "Material Receipt":
        return

    for item in doc.items:
        if not (item.secondary_uom and item.secondary_qty):
            continue

        sle = frappe.new_doc("Secondary UOM Ledger Entry")
        sle.item_code = item.item_code
        sle.warehouse = item.t_warehouse or item.s_warehouse
        sle.posting_date = doc.posting_date
        sle.posting_time = doc.posting_time or nowtime()

        sle.voucher_type = doc.doctype
        sle.voucher_no = doc.name

        #  Material Receipt → Stock IN (+)
        sle.actual_qty = abs(flt(item.secondary_qty))

        sle.stock_uom = item.secondary_uom
        sle.company = doc.company
        sle.batch_no = getattr(item, "batch_no", None)

        sle.insert(ignore_permissions=True)
        sle.submit()

def calc_secondary_from_item(item):

    if not item.item_code:
        return

    item_doc = frappe.get_cached_doc("Item", item.item_code)

    primary_uom = item.stock_uom or item_doc.stock_uom

    secondary_row = next((u for u in item_doc.uoms if u.uom != primary_uom), None)

    if not secondary_row:
        return

    conversion_factor = flt(secondary_row.conversion_factor)

    item.secondary_uom = secondary_row.uom
    item.secondary_conversion_factor = conversion_factor

    if conversion_factor:
        item.secondary_qty = flt(item.qty) / conversion_factor


def populate_secondary(doc, method):

    wo_map = {}

    if doc.work_order:

        wo_items = frappe.get_all(
            "Work Order Item",
            filters={"parent": doc.work_order},
            fields=["item_code", "secondary_uom", "secondary_qty", "required_qty"]
        )

        wo_map = {d.item_code: d for d in wo_items}

    for item in doc.items:

        wo_item = wo_map.get(item.item_code)

        if wo_item and wo_item.secondary_uom:

            item.secondary_uom = wo_item.secondary_uom

            if flt(wo_item.required_qty):
                ratio = flt(item.qty) / flt(wo_item.required_qty)
                item.secondary_qty = flt(wo_item.secondary_qty) * ratio
            else:
                item.secondary_qty = wo_item.secondary_qty

        else:
            calc_secondary_from_item(item)