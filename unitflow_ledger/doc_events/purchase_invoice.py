import frappe
from frappe.utils import nowtime, flt

def create_secondary_sle(doc, method):
    

    # Only when stock is updated
    if not doc.get("update_stock"):
        return

    for item in doc.items:
        if not (item.secondary_uom and item.secondary_qty):
            continue

        sle = frappe.new_doc("Secondary UOM Ledger Entry")
        sle.item_code = item.item_code
        sle.warehouse = item.warehouse
        sle.posting_date = doc.posting_date
        sle.posting_time = doc.posting_time or nowtime()

        sle.voucher_type = doc.doctype
        sle.voucher_no = doc.name

        qty = abs(flt(item.secondary_qty))

        #  CORE LOGIC
        if doc.doctype == "Sales Invoice":
            qty = qty if doc.get("is_return") else -qty

        elif doc.doctype == "Purchase Invoice":
            qty = -qty if doc.get("is_return") else qty

        sle.actual_qty = qty
        sle.stock_uom = item.secondary_uom
        sle.company = doc.company
        sle.batch_no = getattr(item, "batch_no", None)

        sle.insert(ignore_permissions=True)
        sle.submit()
