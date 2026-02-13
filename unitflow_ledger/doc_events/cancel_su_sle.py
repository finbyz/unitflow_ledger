import frappe


def before_cancel(doc, method=None):
	if not frappe.db.table_exists("Secondary UOM Ledger Entry"):
		return

	# Skip link checks during cancel; we will mark related SULE rows as cancelled here.
	doc.flags.ignore_links = True
	frappe.db.sql(
		"""
        UPDATE `tabSecondary UOM Ledger Entry`
        SET
            is_cancelled = 1,
            docstatus = 2
        WHERE
            voucher_type = %s
            AND voucher_no = %s
            AND docstatus < 2
        """,
		(doc.doctype, doc.name),
	)
