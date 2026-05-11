# Copyright (c) 2026, Finbyz Tech Pvt Ltd and contributors
# For license information, please see license.txt

import copy
from collections import OrderedDict

import frappe
from frappe import _, qb
from frappe.query_builder import CustomFunction
from frappe.query_builder.functions import Max
from frappe.utils import date_diff, flt, getdate


def execute(filters=None):
    if not filters:
        return [], [], None, []

    validate_filters(filters)

    columns = get_columns(filters)
    conditions = get_conditions(filters)
    data = get_data(conditions, filters)
    so_elapsed_time = get_so_elapsed_time(data)

    if not data:
        return [], [], None, []

    data, chart_data = prepare_data(data, so_elapsed_time, filters)

    return columns, data, None, chart_data


def validate_filters(filters):
    from_date, to_date = filters.get("from_date"), filters.get("to_date")

    if not from_date and to_date:
        frappe.throw(_("From and To Dates are required."))
    elif date_diff(to_date, from_date) < 0:
        frappe.throw(_("To Date cannot be before From Date."))


def get_conditions(filters):
    conditions = ""

    if filters.get("customer"):
        conditions += " and so.customer in %(customer)s"

    if filters.get("from_date") and filters.get("to_date"):
        conditions += " and so.transaction_date between %(from_date)s and %(to_date)s"

    if filters.get("company"):
        conditions += " and so.company = %(company)s"

    if filters.get("sales_order"):
        conditions += " and so.name in %(sales_order)s"

    if filters.get("status"):
        conditions += " and so.status in %(status)s"

    if filters.get("warehouse"):
        conditions += " and soi.warehouse = %(warehouse)s"

    if filters.get("delay_days"):
        conditions += """
            and DATEDIFF(CURRENT_DATE, soi.delivery_date) >= %(delay_days)s
        """

    return conditions


def get_data(conditions, filters):
    # If detailed view is enabled, get all invoice rows
    # Otherwise, aggregate at SO item level
    if filters.get("show_detailed_view"):
        data = frappe.db.sql(
            f"""
            SELECT
                so.transaction_date as date,
                soi.delivery_date as delivery_date,
                so.name as sales_order,
                so.status, so.customer, soi.item_code,
                sii.parent as sales_invoice,
                si.posting_date as invoice_date,
                (
                    SELECT st.name
                    FROM `tabSales Team` st
                    WHERE st.parent = so.name AND st.parenttype = 'Sales Order'
                    ORDER BY st.idx
                    LIMIT 1
                ) as sales_team,
                (
                    SELECT GROUP_CONCAT(DISTINCT st.sales_person ORDER BY st.idx SEPARATOR ', ')
                    FROM `tabSales Team` st
                    WHERE st.parent = so.name AND st.parenttype = 'Sales Order'
                ) as sales_person,

                DATEDIFF(CURRENT_DATE, soi.delivery_date) as delay_days,
                IF(so.status in ('Completed','To Bill'), 0, DATEDIFF(CURRENT_DATE, soi.delivery_date)) as delay,
                soi.uom,
                soi.qty, soi.delivered_qty,
                IFNULL(soi.secondary_qty, 0) as sec_qty,
                soi.secondary_uom as sec_uom,
                IFNULL(soi.secondary_conversion_factor, 0) as sec_conversion_factor,
                (soi.qty - soi.delivered_qty) AS pending_qty,
                IFNULL(sii.qty, 0) as billed_qty,
                soi.base_amount as amount,
                (soi.delivered_qty * soi.base_rate) as delivered_qty_amount,
                (soi.billed_amt * IFNULL(so.conversion_rate, 1)) as billed_amount,
                (soi.base_amount - (soi.billed_amt * IFNULL(so.conversion_rate, 1))) as pending_amount,
                soi.warehouse as warehouse,
                so.company, soi.name,
                soi.description as description,
                soi.price_list_rate as price_list_rate,
                soi.discount_percentage as discount_percentage,
                soi.discount_amount as discount_amount
            FROM
                `tabSales Order` so,
                `tabSales Order Item` soi
            LEFT JOIN `tabSales Invoice Item` sii
                ON sii.so_detail = soi.name AND sii.docstatus = 1
            LEFT JOIN `tabSales Invoice` si
                ON si.name = sii.parent AND si.docstatus = 1
            WHERE
                soi.parent = so.name
                AND so.status NOT IN ('Stopped', 'On Hold')
                AND so.docstatus = 1
                {conditions}
            ORDER BY so.name ASC, soi.item_code ASC, si.posting_date ASC
        """,
            filters,
            as_dict=1,
        )
    else:
        # Original aggregated query
        data = frappe.db.sql(
            f"""
            SELECT
                so.transaction_date as date,
                soi.delivery_date as delivery_date,
                so.name as sales_order,
                so.status, so.customer, soi.item_code,
                MAX(sii.parent) as sales_invoice,
                MAX(si.posting_date) as invoice_date,
                (
                    SELECT st.name
                    FROM `tabSales Team` st
                    WHERE st.parent = so.name AND st.parenttype = 'Sales Order'
                    ORDER BY st.idx
                    LIMIT 1
                ) as sales_team,
                (
                    SELECT GROUP_CONCAT(DISTINCT st.sales_person ORDER BY st.idx SEPARATOR ', ')
                    FROM `tabSales Team` st
                    WHERE st.parent = so.name AND st.parenttype = 'Sales Order'
                ) as sales_person,

                DATEDIFF(CURRENT_DATE, soi.delivery_date) as delay_days,
                IF(so.status in ('Completed','To Bill'), 0, DATEDIFF(CURRENT_DATE, soi.delivery_date)) as delay,
                soi.uom,
                soi.qty, soi.delivered_qty,
                IFNULL(soi.secondary_qty, 0) as sec_qty,
                soi.secondary_uom as sec_uom,
                IFNULL(soi.secondary_conversion_factor, 0) as sec_conversion_factor,
                (soi.qty - soi.delivered_qty) AS pending_qty,
                IFNULL(SUM(sii.qty), 0) as billed_qty,
                soi.base_amount as amount,
                (soi.delivered_qty * soi.base_rate) as delivered_qty_amount,
                (soi.billed_amt * IFNULL(so.conversion_rate, 1)) as billed_amount,
                (soi.base_amount - (soi.billed_amt * IFNULL(so.conversion_rate, 1))) as pending_amount,
                soi.warehouse as warehouse,
                so.company, soi.name,
                soi.description as description,
                soi.price_list_rate as price_list_rate,
                soi.discount_percentage as discount_percentage,
                soi.discount_amount as discount_amount
            FROM
                `tabSales Order` so,
                `tabSales Order Item` soi
            LEFT JOIN `tabSales Invoice Item` sii
                ON sii.so_detail = soi.name AND sii.docstatus = 1
            LEFT JOIN `tabSales Invoice` si
                ON si.name = sii.parent AND si.docstatus = 1
            WHERE
                soi.parent = so.name
                AND so.status NOT IN ('Stopped', 'On Hold')
                AND so.docstatus = 1
                {conditions}
            GROUP BY soi.name
            ORDER BY so.name ASC, soi.item_code ASC
        """,
            filters,
            as_dict=1,
        )

    return data


def get_so_elapsed_time(data):
    """
    query SO's elapsed time till latest delivery note
    """
    so_elapsed_time = OrderedDict()
    if data:
        sales_orders = [x.sales_order for x in data]

        so = qb.DocType("Sales Order")
        soi = qb.DocType("Sales Order Item")
        dn = qb.DocType("Delivery Note")
        dni = qb.DocType("Delivery Note Item")

        to_seconds = CustomFunction("TO_SECONDS", ["date"])

        query = (
            qb.from_(so)
            .inner_join(soi)
            .on(soi.parent == so.name)
            .left_join(dni)
            .on(dni.so_detail == soi.name)
            .left_join(dn)
            .on(dni.parent == dn.name)
            .select(
                so.name.as_("sales_order"),
                soi.item_code.as_("so_item_code"),
                (
                    to_seconds(Max(dn.posting_date)) - to_seconds(so.transaction_date)
                ).as_("elapsed_seconds"),
            )
            .where((so.name.isin(sales_orders)) & (dn.docstatus == 1))
            .orderby(so.name, soi.name)
            .groupby(soi.name)
        )
        dn_elapsed_time = query.run(as_dict=True)

        for e in dn_elapsed_time:
            key = (e.sales_order, e.so_item_code)
            so_elapsed_time[key] = e.elapsed_seconds

    return so_elapsed_time


def prepare_data(data, so_elapsed_time, filters):
    completed, pending = 0, 0

    if filters.get("group_by_so"):
        sales_order_map = {}

    # Track unique SO items for chart calculation
    so_item_totals = {}
    # Calculated secondary qty from Item UOM master
    calculated_sec_qty_map = get_calculated_sec_qty_map(data)

    for row in data:
        # Calculate totals per SO item (not per invoice line) for chart
        so_item_key = row.get("name")  # soi.name is unique identifier
        if so_item_key not in so_item_totals:
            so_item_totals[so_item_key] = {
                "billed_amount": row["billed_amount"],
                "pending_amount": row["pending_amount"]
            }

        # prepare data for report view
        row["qty_to_bill"] = flt(row["qty"]) - flt(row["billed_qty"])
        # Calculated sec qty: qty / conversion_factor from Item UOM master
        # _calc = calculated_sec_qty_map.get(row.get("item_code")) or {}
        # _cf = flt(_calc.get("conversion_factor", 0))
        # row["calculated_sec_qty"] = flt(row["qty"]) / _cf if _cf else 0
        # row["calculated_sec_uom"] = _calc.get("uom", "")
        # Calculated secondary qty from Item UOM master
        _calc = calculated_sec_qty_map.get(row.get("item_code")) or {}
        _cf = flt(_calc.get("conversion_factor", 0))

        row["calculated_sec_uom"] = _calc.get("uom", "")

        if _cf:
            row["calculated_sec_qty"] = flt(row["qty"]) / _cf
            row["calculated_sec_delivered_qty"] = flt(row["delivered_qty"]) / _cf
            row["calculated_sec_qty_to_deliver"] = flt(row["pending_qty"]) / _cf
            row["calculated_sec_billed_qty"] = flt(row["billed_qty"]) / _cf
            row["calculated_sec_qty_to_bill"] = flt(row["qty_to_bill"]) / _cf
        else:
            row["calculated_sec_qty"] = 0
            row["calculated_sec_delivered_qty"] = 0
            row["calculated_sec_qty_to_deliver"] = 0
            row["calculated_sec_billed_qty"] = 0
            row["calculated_sec_qty_to_bill"] = 0
        row["sec_qty"] = flt(row.get("sec_qty"))

        sec_conversion_factor = flt(row.get("sec_conversion_factor"))
        if not sec_conversion_factor and row["sec_qty"] and flt(row["qty"]):
            sec_conversion_factor = flt(row["qty"]) / row["sec_qty"]
        row["sec_conversion_factor"] = sec_conversion_factor

        if sec_conversion_factor:
            row["sec_delivered_qty"] = flt(row["delivered_qty"]) / sec_conversion_factor
            row["sec_qty_to_deliver"] = flt(row["pending_qty"]) / sec_conversion_factor
            row["sec_billed_qty"] = flt(row["billed_qty"]) / sec_conversion_factor
            row["sec_qty_to_bill"] = flt(row["qty_to_bill"]) / sec_conversion_factor
        else:
            row["sec_delivered_qty"] = 0
            row["sec_qty_to_deliver"] = 0
            row["sec_billed_qty"] = 0
            row["sec_qty_to_bill"] = 0

        row["delay"] = 0 if row["delay"] and row["delay"] < 0 else row["delay"]

        row["time_taken_to_deliver"] = (
            so_elapsed_time.get((row.sales_order, row.item_code))
            if row["status"] in ("To Bill", "Completed")
            else 0
        )

        if filters.get("group_by_so"):
            so_name = row["sales_order"]

            if so_name not in sales_order_map:
                row_copy = copy.deepcopy(row)
                sales_order_map[so_name] = row_copy
            else:
                so_row = sales_order_map[so_name]
                so_row["required_date"] = max(
                    getdate(so_row["delivery_date"]), getdate(row["delivery_date"])
                )
                so_row["delay"] = (
                    min(so_row["delay"], row["delay"])
                    if row["delay"] and so_row["delay"]
                    else so_row["delay"]
                )

                fields = [
                    "qty",
                    "sec_qty",
                    "delivered_qty",
                    "sec_delivered_qty",
                    "pending_qty",
                    "sec_qty_to_deliver",
                    "billed_qty",
                    "sec_billed_qty",
                    "qty_to_bill",
                    "sec_qty_to_bill",
                    "amount",
                    "delivered_qty_amount",
                    "billed_amount",
                    "pending_amount",
                ]
                for field in fields:
                    so_row[field] = flt(row[field]) + flt(so_row[field])

    # Calculate chart totals from unique SO items
    for totals in so_item_totals.values():
        completed += totals["billed_amount"]
        pending += totals["pending_amount"]

    chart_data = prepare_chart_data(pending, completed)

    if filters.get("group_by_so"):
        data = []
        for so in sales_order_map:
            data.append(sales_order_map[so])
        return data, chart_data

    # Handle detailed view with parent-child tree structure
    if filters.get("show_detailed_view"):
        data = prepare_tree_data(data)
        return data, chart_data

    return data, chart_data

def get_calculated_sec_qty_map(data):
    """
    Build a map of item_code -> calculated_sec_qty conversion factor
    from Item UOM Conversion Detail (same logic as Stock Balance report).
    conversion_factor means: 1 secondary UOM = conversion_factor stock UOM units
    So: calculated_sec_qty = qty / conversion_factor
    """
    items = list(set(row["item_code"] for row in data if row.get("item_code")))
    if not items:
        return {}

    item_table = frappe.qb.DocType("Item")
    ucd = frappe.qb.DocType("UOM Conversion Detail")

    # Get stock UOM for each item
    stock_uoms = {}
    res = (
        frappe.qb.from_(item_table)
        .select(item_table.name, item_table.stock_uom)
        .where(item_table.name.isin(items))
        .run(as_dict=True)
    )
    for r in res:
        stock_uoms[r.name] = r.stock_uom

    # Get all UOM conversions ordered by idx
    rows = (
        frappe.qb.from_(ucd)
        .select(ucd.parent, ucd.uom, ucd.idx, ucd.conversion_factor)
        .where(ucd.parent.isin(items))
        .orderby(ucd.parent)
        .orderby(ucd.idx)
        .run(as_dict=True)
    )

    # For each item, pick first non-stock UOM and its conversion factor
    result = {}
    for row in rows:
        if row.parent in result:
            continue
        stock_uom = stock_uoms.get(row.parent)
        if stock_uom and row.uom == stock_uom:
            continue
        result[row.parent] = {
            "uom": row.uom,
            "conversion_factor": flt(row.conversion_factor),
        }

    return result

def prepare_tree_data(data):
    """
    Prepare parent-child tree structure:
    - Parent: Sales Order with aggregated data
    - Children: Individual Sales Invoices with item details (qty only, no amounts)
    """
    from collections import defaultdict
    
    # Group data by Sales Order and Item
    so_item_map = defaultdict(lambda: {
        "parent": None,
        "children": []
    })
    
    for row in data:
        key = (row["sales_order"], row["item_code"])
        
        if so_item_map[key]["parent"] is None:
            # Create parent row (SO + Item summary)
            parent = copy.deepcopy(row)
            parent["indent"] = 0
            parent["sales_invoice"] = None  # Clear invoice for parent
            parent["invoice_date"] = None
            so_item_map[key]["parent"] = parent
        else:
            # Update parent with aggregated values
            parent = so_item_map[key]["parent"]
        
        # Create child row for each invoice (if invoice exists)
        if row.get("sales_invoice"):
            child = {
                "indent": 1,
                "sales_order": row["sales_order"],
                "sales_invoice": row["sales_invoice"],
                "invoice_date": row["invoice_date"],
                "item_code": row["item_code"],
                "description": row["description"],
                "customer": row["customer"],
                "status": row["status"],
                "date": row["date"],
                "delivery_date": row["delivery_date"],
                "sales_person": row["sales_person"],
                "uom": row["uom"],
                "qty": row["billed_qty"],  # Show billed qty in child
                "sec_uom": row["sec_uom"],
                "sec_qty": row["sec_billed_qty"],  # Show sec billed qty
                "warehouse": row["warehouse"],
                "company": row["company"],
                # Clear amount fields for children
                "amount": None,
                "billed_amount": None,
                "pending_amount": None,
                "delivered_qty_amount": None,
                "price_list_rate": None,
                "discount_percentage": None,
                "discount_amount": None,
                "delivered_qty": None,
                "sec_delivered_qty": None,
                "pending_qty": None,
                "sec_qty_to_deliver": None,
                "billed_qty": None,
                "sec_billed_qty": None,
                "qty_to_bill": None,
                "sec_qty_to_bill": None,
                "delay": None,
                "time_taken_to_deliver": None,
            }
            so_item_map[key]["children"].append(child)
    
    # Build final tree structure
    tree_data = []
    for key in sorted(so_item_map.keys()):
        item_data = so_item_map[key]
        parent = item_data["parent"]
        children = item_data["children"]
        
        # Add parent
        tree_data.append(parent)
        
        # Add children
        for child in children:
            tree_data.append(child)
    
    return tree_data


def prepare_chart_data(pending, completed):
    labels = [_("Amount to Bill"), _("Billed Amount")]

    return {
        "data": {"labels": labels, "datasets": [{"values": [pending, completed]}]},
        "type": "donut",
        "height": 300,
    }


def get_columns(filters):
    columns = [
        {"label": _("Date"), "fieldname": "date", "fieldtype": "Date", "width": 90},
        {
            "label": _("Sales Order"),
            "fieldname": "sales_order",
            "fieldtype": "Link",
            "options": "Sales Order",
            "width": 160,
        },
        {
            "label": _("Sales Invoice"),
            "fieldname": "sales_invoice",
            "fieldtype": "Link",
            "options": "Sales Invoice",
            "width": 160,
        },
        {
            "label": _("Invoice Date"),
            "fieldname": "invoice_date",
            "fieldtype": "Date",
            "width": 120,
        },
        {
            "label": _("Status"),
            "fieldname": "status",
            "fieldtype": "Data",
            "width": 130,
        },
        {
            "label": _("Customer"),
            "fieldname": "customer",
            "fieldtype": "Link",
            "options": "Customer",
            "width": 200,
        },
    ]

    if not filters.get("group_by_so"):
        columns.append(
            {
                "label": _("Item Code"),
                "fieldname": "item_code",
                "fieldtype": "Link",
                "options": "Item",
                "width": 280,
            }
        )
        columns.append(
            {
                "label": _("Description"),
                "fieldname": "description",
                "fieldtype": "Small Text",
                "width": 170,
            }
        )

    columns.extend(
        [
            {
                "label": _("Sales Person"),
                "fieldname": "sales_person",
                "fieldtype": "Data",
                "width": 180,
            },
            {
                "label": _("UOM"),
                "fieldname": "uom",
                "fieldtype": "Link",
                "options": "UOM",
                "width": 120,
            },
            {
                "label": _("Qty"),
                "fieldname": "qty",
                "fieldtype": "Float",
                "width": 120,
                "convertible": "qty",
            },
            {
                "label": _("Sec Qty"),
                "fieldname": "sec_qty",
                "fieldtype": "Float",
                "width": 120,
                "convertible": "qty",
            },
            {
                "label": _("Calculated Sec Qty"),
                "fieldname": "calculated_sec_qty",
                "fieldtype": "Float",
                "width": 140,
                "convertible": "qty",
            },
            {
                "label": _("Sec UOM"),
                "fieldname": "sec_uom",
                "fieldtype": "Link",
                "options": "UOM",
                "width": 120,
            },
            {
                "label": _("Delivered Qty"),
                "fieldname": "delivered_qty",
                "fieldtype": "Float",
                "width": 120,
                "convertible": "qty",
            },
            {
    "label": _("Calculated Sec Delivered Qty"),
    "fieldname": "calculated_sec_delivered_qty",
    "fieldtype": "Float",
    "width": 170,
    "convertible": "qty",
},
            {
                "label": _("Sec Delivered Qty"),
                "fieldname": "sec_delivered_qty",
                "fieldtype": "Float",
                "width": 120,
                "convertible": "qty",
            },
            {
                "label": _("Qty to Deliver"),
                "fieldname": "pending_qty",
                "fieldtype": "Float",
                "width": 120,
                "convertible": "qty",
            },
            {
    "label": _("Calculated Sec Qty to Deliver"),
    "fieldname": "calculated_sec_qty_to_deliver",
    "fieldtype": "Float",
    "width": 180,
    "convertible": "qty",
},
            {
                "label": _("Sec Qty to Deliver"),
                "fieldname": "sec_qty_to_deliver",
                "fieldtype": "Float",
                "width": 120,
                "convertible": "qty",
            },
            {
                "label": _("Billed Qty"),
                "fieldname": "billed_qty",
                "fieldtype": "Float",
                "width": 80,
                "convertible": "qty",
            },
            {
    "label": _("Calculated Sec Billed Qty"),
    "fieldname": "calculated_sec_billed_qty",
    "fieldtype": "Float",
    "width": 170,
    "convertible": "qty",
},
            {
                "label": _("Sec Billed Qty"),
                "fieldname": "sec_billed_qty",
                "fieldtype": "Float",
                "width": 120,
                "convertible": "qty",
            },
            {
                "label": _("Qty to Bill"),
                "fieldname": "qty_to_bill",
                "fieldtype": "Float",
                "width": 80,
                "convertible": "qty",
            },
            {
    "label": _("Calculated Sec Qty to Bill"),
    "fieldname": "calculated_sec_qty_to_bill",
    "fieldtype": "Float",
    "width": 170,
    "convertible": "qty",
},
            {
                "label": _("Sec Qty to Bill"),
                "fieldname": "sec_qty_to_bill",
                "fieldtype": "Float",
                "width": 120,
                "convertible": "qty",
            },
            {
                "label": _("Price List Rate (INR)"),
                "fieldname": "price_list_rate",
                "fieldtype": "Currency",
                "width": 150,
                "options": "Company:company:default_currency",
                "convertible": "rate",
            },
            {
                "label": _("Discount (%) on Price List Rate with Margin"),
                "fieldname": "discount_percentage",
                "fieldtype": "Percent",
                "width": 220,
            },
            {
                "label": _("Discount Amount"),
                "fieldname": "discount_amount",
                "fieldtype": "Currency",
                "width": 150,
                "options": "Company:company:default_currency",
                "convertible": "rate",
            },
            {
                "label": _("Amount"),
                "fieldname": "amount",
                "fieldtype": "Currency",
                "width": 110,
                "options": "Company:company:default_currency",
                "convertible": "rate",
            },
            {
                "label": _("Billed Amount"),
                "fieldname": "billed_amount",
                "fieldtype": "Currency",
                "width": 110,
                "options": "Company:company:default_currency",
                "convertible": "rate",
            },
            {
                "label": _("Pending Amount"),
                "fieldname": "pending_amount",
                "fieldtype": "Currency",
                "width": 130,
                "options": "Company:company:default_currency",
                "convertible": "rate",
            },
            {
                "label": _("Amount Delivered"),
                "fieldname": "delivered_qty_amount",
                "fieldtype": "Currency",
                "width": 100,
                "options": "Company:company:default_currency",
                "convertible": "rate",
            },
            {
                "label": _("Delivery Date"),
                "fieldname": "delivery_date",
                "fieldtype": "Date",
                "width": 120,
            },
            {
                "label": _("Delay (in Days)"),
                "fieldname": "delay",
                "fieldtype": "Data",
                "width": 100,
            },
            {
                "label": _("Time Taken to Deliver"),
                "fieldname": "time_taken_to_deliver",
                "fieldtype": "Duration",
                "width": 100,
            },
        ]
    )
    if not filters.get("group_by_so"):
        columns.append(
            {
                "label": _("Warehouse"),
                "fieldname": "warehouse",
                "fieldtype": "Link",
                "options": "Warehouse",
                "width": 130,
            }
        )
    columns.append(
        {
            "label": _("Company"),
            "fieldname": "company",
            "fieldtype": "Link",
            "options": "Company",
            "width": 200,
        }
    )

    return columns