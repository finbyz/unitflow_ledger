# purchase_receipt.py
import frappe
from frappe.utils import nowdate, nowtime, flt

def create_secondary_sle(doc, method):
    """
    Create Stock Ledger Entry for Secondary UOM when Purchase Receipt is submitted
    """
    for item in doc.items:
        # Only create if secondary_qty and secondary_uom exist
        if item.secondary_uom and item.secondary_qty:
            sle = frappe.new_doc("Secondary UOM Ledger Entry")
            sle.item_code = item.item_code
            sle.warehouse = item.warehouse
            sle.posting_date = doc.posting_date
            sle.posting_time = doc.posting_time or nowtime()
            sle.voucher_type = "Purchase Receipt"
            sle.voucher_no = doc.name
            sle.actual_qty = flt(item.secondary_qty)
            sle.stock_uom = item.secondary_uom
            sle.company = doc.company
            sle.batch_no = getattr(item, "batch_no", None)
            # You can also add serial_and_batch_bundle if required
            sle.save(ignore_permissions=True)
            sle.submit()
