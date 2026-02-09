# purchase_receipt.py
import frappe
from frappe.utils import nowtime, flt

def create_secondary_sle(doc, method):
    """
    Create Secondary UOM Stock Ledger Entry for Sales Invoice
    - update_stock must be checked
    - Normal SI  → Qty NEGATIVE
    - Return SI  → Qty POSITIVE
    """

    #  Only when stock is updated
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

        #  Always dynamic
        sle.voucher_type = doc.doctype
        sle.voucher_no = doc.name

        qty = flt(item.secondary_qty)

        # 🔑 REQUIRED LOGIC
        if doc.doctype == "Sales Invoice":
            if doc.get("is_return"):
                qty = abs(qty)    
            else:
                qty = -abs(qty)     

        sle.actual_qty = qty
        sle.stock_uom = item.secondary_uom
        sle.company = doc.company
        sle.batch_no = getattr(item, "batch_no", None)

        sle.insert(ignore_permissions=True)
        sle.submit()
