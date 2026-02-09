import frappe
from frappe.utils import nowtime, flt

def create_secondary_sle(doc, method):
    for item in doc.items:
        if item.secondary_uom and item.secondary_qty:

            qty = flt(item.secondary_qty)

            # OUT stock → make qty negative
            if doc.doctype == "Delivery Note":
                qty = -qty

            sle = frappe.new_doc("Secondary UOM Ledger Entry")
            sle.item_code = item.item_code
            sle.warehouse = item.warehouse
            sle.posting_date = doc.posting_date
            sle.posting_time = doc.posting_time or nowtime()
            sle.voucher_type = doc.doctype
            sle.voucher_no = doc.name
            sle.actual_qty = qty
            sle.stock_uom = item.secondary_uom
            sle.company = doc.company
            sle.batch_no = getattr(item, "batch_no", None)

            sle.save(ignore_permissions=True)
            sle.submit()
