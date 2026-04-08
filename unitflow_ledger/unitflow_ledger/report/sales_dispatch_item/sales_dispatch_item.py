# # Copyright (c) 2026, Finbyz Tech Pvt Ltd and contributors
# # For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt


def execute(filters=None):
    columns = get_columns(filters)
    data = get_data(filters)
    return columns, data


# -------------------- COLUMNS --------------------

def get_columns(filters=None):
    is_detailed = filters.get("detailed_view") if filters else False

    cols = [
        {"label": _("SO No"), "fieldname": "sales_order", "fieldtype": "Link", "options": "Sales Order", "width": 140},
        {"label": _("SO Date"), "fieldname": "transaction_date", "fieldtype": "Date", "width": 100},
        {"label": _("Party"), "fieldname": "customer", "fieldtype": "Link", "options": "Customer", "width": 180},
        {"label": _("Code"), "fieldname": "item_code", "fieldtype": "Link", "options": "Item", "width": 160},
        {"label": _("Description"), "fieldname": "description", "fieldtype": "Data", "width": 220},
        {"label": _("Qty 1"), "fieldname": "stock_qty", "fieldtype": "Float", "width": 110},
        {"label": _("Unit 1"), "fieldname": "stock_uom", "fieldtype": "Link", "options": "UOM", "width": 80},
        {"label": _("Qty 2"), "fieldname": "secondary_qty", "fieldtype": "Float", "width": 110},
        {"label": _("Unit 2"), "fieldname": "secondary_uom", "fieldtype": "Link", "options": "UOM", "width": 80},
        {"label": _("Despatched Qty 1"), "fieldname": "delivered_stock_qty", "fieldtype": "Float", "width": 130},
        {"label": _("Despatched Qty 2"), "fieldname": "delivered_secondary_qty", "fieldtype": "Float", "width": 130},
        {"label": _("Pending Qty 1"), "fieldname": "pending_stock_qty", "fieldtype": "Float", "width": 120},
        {"label": _("Pending Qty 2"), "fieldname": "pending_secondary_qty", "fieldtype": "Float", "width": 120},
    ]

    if is_detailed:
        cols.extend([
            {"label": _("Rate"), "fieldname": "rate", "fieldtype": "Currency", "width": 100},
            {"label": _("Disc %"), "fieldname": "discount_percentage", "fieldtype": "Percent", "width": 80},
            {"label": _("Disc Amt"), "fieldname": "discount_amount", "fieldtype": "Currency", "width": 100},
            {"label": _("Value"), "fieldname": "net_amount", "fieldtype": "Currency", "width": 120},
            {"label": _("Total Order Value"), "fieldname": "total_order_value", "fieldtype": "Currency", "width": 140},
            {"label": _("Executed Qty 1"), "fieldname": "executed_qty1", "fieldtype": "Float", "width": 120},
            {"label": _("Executed Qty 2"), "fieldname": "executed_qty2", "fieldtype": "Float", "width": 120},
            {"label": _("Pending Qty 1"), "fieldname": "pending_qty1", "fieldtype": "Float", "width": 120},
            {"label": _("Pending Qty 2"), "fieldname": "pending_qty2", "fieldtype": "Float", "width": 120},
            {"label": _("Sch. Date"), "fieldname": "schedule_date", "fieldtype": "Date", "width": 100},
            {"label": _("Entered By"), "fieldname": "entered_by", "fieldtype": "Data", "width": 120},
            {"label": _("Inv. No"), "fieldname": "invoice_no", "fieldtype": "Link", "options": "Sales Invoice", "width": 140},
            {"label": _("Inv. Date"), "fieldname": "invoice_date", "fieldtype": "Date", "width": 100},
            {"label": _("Inv. Qty"), "fieldname": "invoice_qty", "fieldtype": "Float", "width": 110},
        ])

    return cols

def get_data(filters):
    is_detailed = bool(filters and filters.get("detailed_view"))

    conditions = []
    if filters.get("from_date"): conditions.append("so.transaction_date >= %(from_date)s")
    if filters.get("to_date"):   conditions.append("so.transaction_date <= %(to_date)s")
    if filters.get("sales_order"): conditions.append("so.name = %(sales_order)s")
    if filters.get("item_code"):   conditions.append("soi.item_code = %(item_code)s")
    if filters.get("customer"):    conditions.append("so.customer = %(customer)s")

    cond = " AND ".join(conditions) if conditions else "1=1"

    # ---------------- SO ITEMS ----------------
    so_items = frappe.db.sql(f"""
        SELECT 
            so.name AS sales_order,
            so.transaction_date,
            so.customer,
            soi.name AS so_item_name,
            soi.item_code,
            soi.item_name,
            soi.description,
            soi.stock_qty,
            soi.stock_uom,
            soi.secondary_qty,
            soi.secondary_uom,
            soi.secondary_conversion_factor,
            soi.delivered_qty AS so_delivered_stock_qty,
            soi.rate,
            soi.discount_percentage,
            soi.discount_amount,
            soi.net_amount,
            soi.amount AS total_order_value,
            soi.delivery_date AS schedule_date,
            soi.owner AS entered_by
        FROM `tabSales Order` so
        JOIN `tabSales Order Item` soi ON soi.parent = so.name
        WHERE so.docstatus = 1 
          AND so.status NOT IN ('Cancelled', 'Closed')
          AND {cond}
        ORDER BY so.name, soi.idx
    """, filters, as_dict=True)

    if not so_items:
        return []

    so_item_names = [d.so_item_name for d in so_items]
    so_names = list({d.sales_order for d in so_items})

    # ---------------- DELIVERY NOTE ----------------
    dn_data = frappe.db.sql("""
        SELECT 
            dni.so_detail,
            dni.against_sales_order,
            dni.item_code,
            dni.stock_qty,
            dni.secondary_qty,
            dni.secondary_conversion_factor
        FROM `tabDelivery Note Item` dni
        JOIN `tabDelivery Note` dn ON dn.name = dni.parent
        WHERE dn.docstatus = 1 AND dn.is_return = 0
          AND (dni.so_detail IN %(so_item_names)s 
               OR (dni.so_detail IS NULL AND dni.against_sales_order IN %(so_names)s))
    """, {"so_item_names": so_item_names, "so_names": so_names}, as_dict=True)

    # ---------------- SALES INVOICE (FIXED) ----------------
    si_data = frappe.db.sql("""
        SELECT 
            sii.so_detail,
            sii.sales_order,
            sii.item_code,
            sii.stock_qty,
            si.name AS invoice_no,
            si.posting_date AS invoice_date
        FROM `tabSales Invoice Item` sii
        JOIN `tabSales Invoice` si ON si.name = sii.parent
        WHERE si.docstatus = 1
          AND (sii.so_detail IN %(so_item_names)s 
               OR (sii.so_detail IS NULL AND sii.sales_order IN %(so_names)s))
    """, {"so_item_names": so_item_names, "so_names": so_names}, as_dict=True)

    # ---------------- MAP DELIVERY ----------------
    secondary_delivered = {}
    for row in dn_data:
        target = row.so_detail
        if not target:
            for it in so_items:
                if it.sales_order == row.against_sales_order and it.item_code == row.item_code:
                    target = it.so_item_name
                    break

        if target:
            sec = flt(row.secondary_qty) or (
                flt(row.stock_qty) / flt(row.secondary_conversion_factor)
                if row.secondary_conversion_factor else 0
            )
            secondary_delivered[target] = secondary_delivered.get(target, 0) + sec

    # ---------------- MAP INVOICE (FIXED CORE) ----------------
    invoice_map = {}

    for row in si_data:
        target = row.so_detail

        if not target:
            for it in so_items:
                if it.sales_order == row.sales_order and it.item_code == row.item_code:
                    target = it.so_item_name
                    break

        if not target:
            continue

        if target not in invoice_map:
            invoice_map[target] = {
                "qty": 0,
                "invoice_no": row.invoice_no,
                "invoice_date": row.invoice_date
            }

        invoice_map[target]["qty"] += flt(row.stock_qty)

        # Keep latest invoice
        if row.invoice_date and (
            not invoice_map[target]["invoice_date"] or
            row.invoice_date > invoice_map[target]["invoice_date"]
        ):
            invoice_map[target]["invoice_no"] = row.invoice_no
            invoice_map[target]["invoice_date"] = row.invoice_date

    # ---------------- BUILD TREE STRUCTURE ----------------
    # Group items by sales order
    sales_order_map = {}
    
    for item in so_items:
        sales_order = item.sales_order
        if sales_order not in sales_order_map:
            sales_order_map[sales_order] = {
                "indent": 0,
                "is_group": 1,
                "parent": None,
                "sales_order": sales_order,
                "transaction_date": item.transaction_date,
                "customer": item.customer,
                "item_code": "",
                "description": f"Sales Order: {sales_order}",
                "stock_qty": 0,
                "stock_uom": "",
                "secondary_qty": 0,
                "secondary_uom": "",
                "delivered_stock_qty": 0,
                "delivered_secondary_qty": 0,
                "pending_stock_qty": 0,
                "pending_secondary_qty": 0,
                "children": []
            }
        
        del1 = flt(item.so_delivered_stock_qty)
        del2 = flt(secondary_delivered.get(item.so_item_name, 0))
        ord2 = flt(item.secondary_qty) or (
            flt(item.stock_qty) / flt(item.secondary_conversion_factor)
            if item.secondary_conversion_factor else 0
        )

        inv = invoice_map.get(item.so_item_name, {})
        inv_qty = flt(inv.get("qty", 0))
        
        child_item = {
            "indent": 1,
            "is_group": 0,
            "parent": sales_order,
            "sales_order": item.sales_order,
            "transaction_date": item.transaction_date,
            "customer": item.customer,
            "item_code": item.item_code,
            "description": item.item_name or item.description,
            "stock_qty": flt(item.stock_qty),
            "stock_uom": item.stock_uom,
            "secondary_qty": ord2,
            "secondary_uom": item.secondary_uom or item.stock_uom,
            "delivered_stock_qty": del1,
            "delivered_secondary_qty": del2,
            "pending_stock_qty": flt(item.stock_qty) - del1,
            "pending_secondary_qty": ord2 - del2,
            # detailed
            "rate": item.rate,
            "discount_percentage": item.discount_percentage,
            "discount_amount": item.discount_amount,
            "net_amount": item.net_amount,
            "total_order_value": item.total_order_value,
            "executed_qty1": del1,
            "executed_qty2": del2,
            "pending_qty1": flt(item.stock_qty) - del1,
            "pending_qty2": ord2 - del2,
            "schedule_date": item.schedule_date,
            "entered_by": item.entered_by,
            "invoice_no": inv.get("invoice_no"),
            "invoice_date": inv.get("invoice_date"),
            "invoice_qty": inv_qty,
        }
        
        sales_order_map[sales_order]["children"].append(child_item)
        
        # Update parent totals
        sales_order_map[sales_order]["stock_qty"] += child_item["stock_qty"]
        sales_order_map[sales_order]["secondary_qty"] += child_item["secondary_qty"]
        sales_order_map[sales_order]["delivered_stock_qty"] += child_item["delivered_stock_qty"]
        sales_order_map[sales_order]["delivered_secondary_qty"] += child_item["delivered_secondary_qty"]
        sales_order_map[sales_order]["pending_stock_qty"] += child_item["pending_stock_qty"]
        sales_order_map[sales_order]["pending_secondary_qty"] += child_item["pending_secondary_qty"]
        
        if is_detailed:
            sales_order_map[sales_order]["total_order_value"] = sales_order_map[sales_order].get("total_order_value", 0) + flt(child_item.get("total_order_value", 0))
            sales_order_map[sales_order]["net_amount"] = sales_order_map[sales_order].get("net_amount", 0) + flt(child_item.get("net_amount", 0))
    
    # Flatten the tree structure for the report
    data = []
    for so_order in sales_order_map.values():
        data.append(so_order)
        data.extend(so_order["children"])
        # Add subtotal row after children
        if so_order["children"]:
            subtotal_row = {
                "indent": 1,
                "is_subtotal": 1,
                "is_group": 0,
                "parent": so_order["sales_order"],
                "sales_order": "",
                "transaction_date": None,
                "customer": "",
                "item_code": "",
                "description": f"Subtotal for {so_order['sales_order']}",
                "stock_qty": so_order["stock_qty"],
                "stock_uom": "",
                "secondary_qty": so_order["secondary_qty"],
                "secondary_uom": "",
                "delivered_stock_qty": so_order["delivered_stock_qty"],
                "delivered_secondary_qty": so_order["delivered_secondary_qty"],
                "pending_stock_qty": so_order["pending_stock_qty"],
                "pending_secondary_qty": so_order["pending_secondary_qty"],
            }
            if is_detailed:
                subtotal_row["total_order_value"] = so_order.get("total_order_value", 0)
                subtotal_row["net_amount"] = so_order.get("net_amount", 0)
            data.append(subtotal_row)

    return data