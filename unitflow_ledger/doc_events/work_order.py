import frappe
from erpnext.manufacturing.doctype.work_order.work_order import make_stock_entry


@frappe.whitelist()
def custom_make_stock_entry(work_order_id, purpose, qty=None):
    doc = make_stock_entry(work_order_id, purpose, qty)

    work_order = frappe.get_doc("Work Order", work_order_id)

    wo_item_map = {}

    for row in work_order.required_items:
        wo_item_map[row.item_code] = {
            "secondary_uom": row.secondary_uom,
            "secondary_qty": row.secondary_qty
        }

    for item in doc.get("items"):
        if item.item_code in wo_item_map:
            item.secondary_uom = wo_item_map[item.item_code]["secondary_uom"]
            item.secondary_qty = wo_item_map[item.item_code]["secondary_qty"]

    return doc