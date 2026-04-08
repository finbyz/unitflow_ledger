# Copyright (c) 2026, Finbyz Tech Pvt Ltd and contributors
# For license information, please see license.txt

# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, getdate

def execute(filters=None):
    columns = get_columns(filters)
    data = get_data(filters)
    return columns, data

def get_columns(filters=None):
    return [
        {"label": _("Posting Date"), "fieldname": "posting_date", "fieldtype": "Date", "width": 110},
        {"label": _("Posting Time"), "fieldname": "posting_time", "fieldtype": "Time", "width": 100},
        {"label": _("Item Code"), "fieldname": "item_code", "fieldtype": "Link", "options": "Item", "width": 150},
        {"label": _("Warehouse"), "fieldname": "warehouse", "fieldtype": "Link", "options": "Warehouse", "width": 150},
        {"label": _("Voucher Type"), "fieldname": "voucher_type", "fieldtype": "Data", "width": 130},
        {"label": _("Voucher No"), "fieldname": "voucher_no", "fieldtype": "Dynamic Link", "options": "voucher_type", "width": 180},
        {"label": _("Actual Qty"), "fieldname": "actual_qty", "fieldtype": "Float", "width": 120},
        {"label": _("Qty After Transaction"), "fieldname": "qty_after_transaction", "fieldtype": "Float", "width": 150},
        {"label": _("Created By"), "fieldname": "owner", "fieldtype": "Data", "width": 150},
        {"label": _("Created On"), "fieldname": "creation", "fieldtype": "Datetime", "width": 160},
    ]

def get_data(filters):
    conditions = []
    values = {}

    # Mandatory filters
    if filters.get("from_date"):
        conditions.append("sule.posting_date >= %(from_date)s")
        values["from_date"] = filters["from_date"]
    
    if filters.get("to_date"):
        conditions.append("sule.posting_date <= %(to_date)s")
        values["to_date"] = filters["to_date"]
    
    if filters.get("company"):
        conditions.append("sule.company = %(company)s")
        values["company"] = filters["company"]
    
    # Optional filters
    if filters.get("item_code"):
        conditions.append("sule.item_code = %(item_code)s")
        values["item_code"] = filters["item_code"]
    
    if filters.get("warehouse"):
        conditions.append("sule.warehouse = %(warehouse)s")
        values["warehouse"] = filters["warehouse"]
    
    if filters.get("voucher_type"):
        conditions.append("sule.voucher_type = %(voucher_type)s")
        values["voucher_type"] = filters["voucher_type"]
    
    if filters.get("voucher_no"):
        conditions.append("sule.voucher_no = %(voucher_no)s")
        values["voucher_no"] = filters["voucher_no"]
    
    # Cancelled entries filter
    if not filters.get("show_cancelled_entries"):
        conditions.append("sule.is_cancelled = 0")
    
    cond_str = " AND ".join(conditions) if conditions else "1=1"
    
    # Fetch data from Secondary UOM Ledger Entry
    data = frappe.db.sql(f"""
        SELECT 
            sule.posting_date,
            sule.posting_time,
            sule.item_code,
            sule.warehouse,
            sule.voucher_type,
            sule.voucher_no,
            sule.actual_qty,
            sule.qty_after_transaction,
            sule.company,
            sule.owner,
            sule.creation,
            sule.is_cancelled,
            sule.modified,
            sule.modified_by
        FROM `tabSecondary UOM Ledger Entry` sule
        WHERE {cond_str}
        ORDER BY sule.posting_date DESC, sule.posting_time DESC, sule.creation DESC
    """, values, as_dict=True)
    
    # Add running balance if needed
    if data:
        running_balance = {}
        for row in data:
            # Group by item and warehouse for running balance
            key = f"{row.item_code}_{row.warehouse}"
            if key not in running_balance:
                # Get opening balance before from_date
                opening_balance = get_opening_balance(
                    row.item_code, 
                    row.warehouse, 
                    filters.get("from_date"), 
                    filters.get("company")
                )
                running_balance[key] = opening_balance
            
            running_balance[key] += flt(row.actual_qty)
            row["qty_after_transaction"] = running_balance[key]
    
    # Add total row
    if data:
        total_qty = sum(flt(d.actual_qty) for d in data)
        total_row = {
            "posting_date": "",
            "posting_time": "",
            "item_code": "",
            "warehouse": "",
            "voucher_type": "",
            "voucher_no": "<b>Total</b>",
            "actual_qty": total_qty,
            "qty_after_transaction": "",
            "company": "",
            "owner": "",
            "creation": "",
            "is_cancelled": "",
            "is_total_row": 1
        }
        data.append(total_row)
    
    return data

def get_opening_balance(item_code, warehouse, from_date, company):
    """Get opening balance for item and warehouse before from_date"""
    if not from_date:
        return 0
    
    opening_balance = frappe.db.sql("""
        SELECT SUM(actual_qty) as opening_qty
        FROM `tabSecondary UOM Ledger Entry`
        WHERE item_code = %(item_code)s
            AND warehouse = %(warehouse)s
            AND posting_date < %(from_date)s
            AND company = %(company)s
            AND is_cancelled = 0
    """, {
        "item_code": item_code,
        "warehouse": warehouse,
        "from_date": from_date,
        "company": company
    }, as_dict=True)
    
    return flt(opening_balance[0].opening_qty if opening_balance else 0)