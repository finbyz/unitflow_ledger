const wo_item_doc_cache = {};

frappe.ui.form.on("Work Order", {
	onload(frm) {
		schedule_work_order_recalculation(frm, 0);
	},

	onload_post_render(frm) {
		schedule_work_order_recalculation(frm, 100);
	},

	setup(frm) {
		schedule_work_order_recalculation(frm, 0);
	},

	refresh(frm) {
		schedule_work_order_recalculation(frm, 100);
	},

	required_items(frm) {
		schedule_work_order_recalculation(frm, 50);
	},

	qty(frm) {
		// Parent qty updates required_items.required_qty; recalc after those updates land.
		schedule_work_order_recalculation(frm, 250);
	},

	before_save(frm) {
		return recalculate_work_order_rows(frm);
	},
});

frappe.ui.form.on("Work Order Item", {
	item_code(frm, cdt, cdn) {
		return update_work_order_secondary_fields(cdt, cdn);
	},

	required_qty(frm, cdt, cdn) {
		return update_work_order_secondary_fields(cdt, cdn);
	},

	stock_uom(frm, cdt, cdn) {
		return update_work_order_secondary_fields(cdt, cdn);
	},

	required_items_add(frm) {
		schedule_work_order_recalculation(frm, 50);
	},
});

function schedule_work_order_recalculation(frm, delay = 0) {
	clearTimeout(frm.__wo_secondary_recalc_timer);
	frm.__wo_secondary_recalc_timer = setTimeout(() => {
		recalculate_work_order_rows(frm);
	}, delay);
}

async function recalculate_work_order_rows(frm) {
	if (!frm.doc.required_items || !frm.doc.required_items.length) {
		return;
	}

	for (const row of frm.doc.required_items) {
		await update_work_order_secondary_fields(row.doctype, row.name);
	}
}

async function update_work_order_secondary_fields(cdt, cdn) {
	const row = locals[cdt] && locals[cdt][cdn];
	if (!row) {
		return;
	}

	if (!row.item_code) {
		await frappe.model.set_value(cdt, cdn, "required_uom", null);
		await frappe.model.set_value(cdt, cdn, "secondary_uom", null);
		await frappe.model.set_value(cdt, cdn, "secondary_qty", 0);
		return;
	}

	const item_doc = await get_work_order_item_doc(row.item_code);
	if (!item_doc) {
		return;
	}

	const primary_uom = row.stock_uom || item_doc.stock_uom;
	await frappe.model.set_value(cdt, cdn, "required_uom", primary_uom);

	const secondary_row = (item_doc.uoms || []).find((u) => u.uom !== primary_uom);
	if (!secondary_row) {
		await frappe.model.set_value(cdt, cdn, "secondary_uom", null);
		await frappe.model.set_value(cdt, cdn, "secondary_qty", 0);
		return;
	}

	const required_qty = flt(row.required_qty);
	const conversion_factor = flt(secondary_row.conversion_factor);
	const secondary_qty = conversion_factor ? required_qty / conversion_factor : 0;

	await frappe.model.set_value(cdt, cdn, "secondary_uom", secondary_row.uom);
	await frappe.model.set_value(cdt, cdn, "secondary_qty", secondary_qty);
}

async function get_work_order_item_doc(item_code) {
	if (!item_code) {
		return null;
	}

	if (!wo_item_doc_cache[item_code]) {
		wo_item_doc_cache[item_code] = frappe.db.get_doc("Item", item_code);
	}

	return wo_item_doc_cache[item_code];
}
