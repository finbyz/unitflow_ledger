const bom_item_doc_cache = {};

frappe.ui.form.on("BOM", {
	setup(frm) {
		recalculate_bom_rows(frm);
	},

	refresh(frm) {
		recalculate_bom_rows(frm);
	},
});

frappe.ui.form.on("BOM Item", {
	item_code(frm, cdt, cdn) {
		return update_bom_secondary_fields(cdt, cdn);
	},

	qty(frm, cdt, cdn) {
		return update_bom_secondary_fields(cdt, cdn);
	},

	uom(frm, cdt, cdn) {
		return update_bom_secondary_fields(cdt, cdn);
	},
});

async function recalculate_bom_rows(frm) {
	if (!frm.doc.items || !frm.doc.items.length) {
		return;
	}

	for (const row of frm.doc.items) {
		await update_bom_secondary_fields(row.doctype, row.name);
	}
}

async function update_bom_secondary_fields(cdt, cdn) {
	const row = locals[cdt] && locals[cdt][cdn];
	if (!row) {
		return;
	}

	if (!row.item_code) {
		await frappe.model.set_value(cdt, cdn, "secondary_uom", null);
		await frappe.model.set_value(cdt, cdn, "secondary_qty", 0);
		return;
	}

	const item_doc = await get_bom_item_doc(row.item_code);
	if (!item_doc) {
		return;
	}

	const primary_uom = row.uom || item_doc.stock_uom;
	const secondary_row = (item_doc.uoms || []).find((u) => u.uom !== primary_uom);

	if (!secondary_row) {
		await frappe.model.set_value(cdt, cdn, "secondary_uom", null);
		await frappe.model.set_value(cdt, cdn, "secondary_qty", 0);
		return;
	}

	const qty = flt(row.qty);
	const conversion_factor = flt(secondary_row.conversion_factor);
	const secondary_qty = conversion_factor ? qty / conversion_factor : 0;

	await frappe.model.set_value(cdt, cdn, "secondary_uom", secondary_row.uom);
	await frappe.model.set_value(cdt, cdn, "secondary_qty", secondary_qty);
}

async function get_bom_item_doc(item_code) {
	if (!item_code) {
		return null;
	}

	if (!bom_item_doc_cache[item_code]) {
		bom_item_doc_cache[item_code] = frappe.db.get_doc("Item", item_code);
	}

	return bom_item_doc_cache[item_code];
}
