frappe.ui.form.on("Work Order", {
	before_save(frm) {
		return set_secondary_fields_for_required_items(frm);
	},
});

async function set_secondary_fields_for_required_items(frm) {
	if (!frm.doc.required_items || !frm.doc.required_items.length) {
		return;
	}

	const item_codes = [...new Set(
		(frm.doc.required_items || [])
			.map((row) => row.item_code)
			.filter(Boolean)
	)];

	if (!item_codes.length) {
		return;
	}

	const response = await frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: "Item",
			filters: {
				name: ["in", item_codes],
			},
			fields: ["name", "stock_uom"],
			limit_page_length: item_codes.length,
		},
	});

	const items = response.message || [];
	const stock_uom_by_item = {};
	const item_doc_cache = {};
	for (const item of items) {
		stock_uom_by_item[item.name] = item.stock_uom;
	}

	for (const row of frm.doc.required_items) {
		if (!row.item_code) {
			frappe.model.set_value(row.doctype, row.name, "required_uom", null);
			frappe.model.set_value(row.doctype, row.name, "secondary_uom", null);
			frappe.model.set_value(row.doctype, row.name, "secondary_qty", 0);
			continue;
		}

		if (!item_doc_cache[row.item_code]) {
			item_doc_cache[row.item_code] = await frappe.db.get_doc("Item", row.item_code);
		}
		const item_doc = item_doc_cache[row.item_code];
		const primary_uom = row.stock_uom || stock_uom_by_item[row.item_code] || item_doc.stock_uom;

		frappe.model.set_value(row.doctype, row.name, "required_uom", primary_uom);

		const secondary_row = (item_doc.uoms || []).find((u) => u.uom !== primary_uom);
		if (!secondary_row) {
			frappe.model.set_value(row.doctype, row.name, "secondary_uom", null);
			frappe.model.set_value(row.doctype, row.name, "secondary_qty", 0);
			continue;
		}

		const required_qty = flt(row.required_qty);
		const conversion_factor = flt(secondary_row.conversion_factor);
		const secondary_qty = conversion_factor ? required_qty / conversion_factor : 0;

		frappe.model.set_value(row.doctype, row.name, "secondary_uom", secondary_row.uom);
		frappe.model.set_value(row.doctype, row.name, "secondary_qty", secondary_qty);
	}
}
