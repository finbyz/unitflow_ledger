import frappe
from frappe.utils import flt
from frappe.query_builder import Order


def create_secondary_uom_ledger_entry(sle_doc, method):
	item = frappe.get_doc("Item", sle_doc.item_code)
	
	# Check if item has multiple UOMs (secondary UOM exists)
	if not item.uoms or len(item.uoms) <= 1:
		return

	# Get secondary UOM details from uoms table
	# Primary UOM is at idx=1, Secondary UOM is at idx=2 (or next available)
	secondary_uom_detail = None
	
	for uom_detail in item.uoms:
		# Skip the primary/stock UOM (idx=1 or uom matching stock_uom)
		if uom_detail.idx == 1 or uom_detail.uom == item.stock_uom:
			continue
		# Take the first non-primary UOM as secondary
		secondary_uom_detail = uom_detail
		break

	if not secondary_uom_detail:
		return

	# Get conversion factor and secondary UOM
	conversion_factor = flt(secondary_uom_detail.conversion_factor)
	secondary_uom = secondary_uom_detail.uom

	if not conversion_factor or not secondary_uom:
		return

	# Calculate secondary quantity
	secondary_qty = get_secondary_qty(sle_doc, conversion_factor)
	if secondary_qty is None:
		return

	# Adjust sign based on voucher type
	secondary_qty = adjust_secondary_qty_sign(sle_doc, secondary_qty)

	# Create Secondary UOM Ledger Entry
	doc = frappe.new_doc("Secondary UOM Ledger Entry")
	doc.update({
		"posting_date": sle_doc.posting_date,
		"posting_time": sle_doc.posting_time,
		"item_code": sle_doc.item_code,
		"warehouse": sle_doc.warehouse,
		"voucher_type": sle_doc.voucher_type,
		"voucher_no": sle_doc.voucher_no,
		"serial_and_batch_bundle": sle_doc.serial_and_batch_bundle,
		"actual_qty": secondary_qty,
		"company": sle_doc.company,
		"unit_of_measure": secondary_uom,
		"is_cancelled": sle_doc.is_cancelled,
		"batch_no": sle_doc.batch_no,
		"docstatus": sle_doc.docstatus
	})

	doc.qty_after_transaction = get_secondary_qty_after_transaction(doc)
	doc.insert(ignore_permissions=True)


def get_secondary_qty(sle_doc, conversion_factor):
	"""
	Convert primary qty (meters) to secondary qty (coils)
	Formula: secondary_qty = actual_qty / conversion_factor
	Example: 76.23 meters / 76.23 = 1 coil
	"""
	if not sle_doc.actual_qty:
		return None
	return flt(sle_doc.actual_qty) / flt(conversion_factor)


def adjust_secondary_qty_sign(sle_doc, qty):
	# Sales transactions (outward)
	if sle_doc.voucher_type in ("Delivery Note", "Sales Invoice"):
		return -abs(qty)

	# Purchase transactions
	if sle_doc.voucher_type == "Purchase Receipt":
		is_return = frappe.db.get_value("Purchase Receipt", sle_doc.voucher_no, "is_return")
		if is_return:
			return -abs(qty)  # Return = Stock Out
		return abs(qty)  # Receipt = Stock In

	# Purchase Invoice transactions
	if sle_doc.voucher_type == "Purchase Invoice":
		is_return = frappe.db.get_value("Purchase Invoice", sle_doc.voucher_no, "is_return")
		if is_return:
			return -abs(qty)  # Return = Stock Out
		return abs(qty)  # Receipt = Stock In

	# Stock Entry transactions
	if sle_doc.voucher_type == "Stock Entry":
		purpose = frappe.db.get_value("Stock Entry", sle_doc.voucher_no, "purpose")

		# Outward movements
		if purpose in ("Material Issue", "Send to Subcontractor"):
			return -abs(qty)

		# Inward movements
		if purpose in ("Material Receipt", "Receive from Subcontractor"):
			return abs(qty)

		# For transfers, rely on actual_qty sign
		return qty if sle_doc.actual_qty > 0 else -abs(qty)

	# Default: preserve the sign
	return abs(qty) if sle_doc.actual_qty > 0 else -abs(qty)


def get_secondary_qty_after_transaction(doc):
	"""
	Calculate running balance per Item + Warehouse + Secondary UOM
	
	Returns the cumulative quantity after this transaction
	"""

	# Get the last balance for this item-warehouse-uom combination
	last = (
		frappe.qb.from_("Secondary UOM Ledger Entry")
		.select("qty_after_transaction")
		.where(
			(frappe.qb.DocType("Secondary UOM Ledger Entry").item_code == doc.item_code) &
			(frappe.qb.DocType("Secondary UOM Ledger Entry").warehouse == doc.warehouse) &
			(frappe.qb.DocType("Secondary UOM Ledger Entry").unit_of_measure == doc.unit_of_measure) &
			(frappe.qb.DocType("Secondary UOM Ledger Entry").name != doc.name)
		)
		.orderby("posting_date", order=Order.desc)
		.orderby("posting_time", order=Order.desc)
		.orderby("creation", order=Order.desc)
		.limit(1)
	).run()

	last_qty = flt(last[0][0]) if last else 0

	# Calculate change
	if doc.is_cancelled:
		change = -doc.actual_qty
	else:
		change = doc.actual_qty

	return last_qty + change


# Alternative helper function to get secondary UOM info
def get_secondary_uom_details(item_code):
	item = frappe.get_doc("Item", item_code)
	
	if not item.uoms or len(item.uoms) <= 1:
		return None

	# Find secondary UOM (first non-primary UOM)
	for uom_detail in item.uoms:
		if uom_detail.idx == 1 or uom_detail.uom == item.stock_uom:
			continue
		
		return {
			'secondary_uom': uom_detail.uom,
			'conversion_factor': flt(uom_detail.conversion_factor),
			'has_secondary_uom': True,
			'stock_uom': item.stock_uom
		}
	
	return None