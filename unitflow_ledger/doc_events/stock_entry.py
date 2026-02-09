# purchase_receipt.py
import frappe
from frappe.utils import nowtime, flt

def create_secondary_sle(doc, method):
    """
    Create Secondary UOM Stock Ledger Entry
    Only for Stock Entry → Material Receipt
    """

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
