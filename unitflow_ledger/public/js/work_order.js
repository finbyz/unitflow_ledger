const wo_item_doc_cache = {};

frappe.ui.form.on("Work Order", {
	qty(frm) {
		schedule_work_order_recalculation(frm, 300);
	},

	before_save(frm) {
		return recalculate_work_order_rows(frm);
	},
	sec_qty: function (frm) {
		calculate_qty_from_sec_qty(frm);
	},
	production_item: function (frm) {
		if (frm.doc.sec_qty) {
			calculate_qty_from_sec_qty(frm);
		}
	}
});

function calculate_qty_from_sec_qty(frm) {
	if (!frm.doc.production_item || !frm.doc.sec_qty) return;

	frappe.call({
		method: 'frappe.client.get',
		args: {
			doctype: 'Item',
			name: frm.doc.production_item
		},
		callback: function (r) {
			if (!r.message) return;

			let item = r.message;
			let base_uom = item.stock_uom;

			// Find UOM row that is NOT the base/stock UOM
			let secondary = (item.uoms || []).find(row => row.uom !== base_uom);

			if (secondary && secondary.conversion_factor) {
				// Has secondary UOM → apply conversion
				frm.set_value('qty', flt(frm.doc.sec_qty * secondary.conversion_factor, 3));
			} else {
				// No secondary UOM → use sec_qty as qty directly
				frm.set_value('qty', flt(frm.doc.sec_qty, 3));
			}
		}
	});
}

frappe.ui.form.on("Work Order Item", {
	item_code: function (frm, cdt, cdn) {
		setTimeout(() => {
			update_work_order_secondary_fields(frm, cdt, cdn).then(() => {
				frm.refresh_field("required_items");
			});
		}, 300);
	},

	required_qty: function (frm, cdt, cdn) {
		update_work_order_secondary_fields(frm, cdt, cdn).then(() => {
			frm.refresh_field("required_items");
		});
	},

	stock_uom: function (frm, cdt, cdn) {
		update_work_order_secondary_fields(frm, cdt, cdn).then(() => {
			frm.refresh_field("required_items");
		});
	},

	required_items_add: function (frm, cdt, cdn) {
		schedule_work_order_recalculation(frm, 300);
	}
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
		await update_work_order_secondary_fields(frm, row.doctype, row.name);
	}

	frm.refresh_field("required_items");
}

async function update_work_order_secondary_fields(frm, cdt, cdn) {
	const row = locals[cdt] && locals[cdt][cdn];
	if (!row) {
		return;
	}

	try {
		if (!row.item_code) {
			await clear_work_order_secondary_fields(frm, cdt, cdn);
			return;
		}

		const item_doc = await get_work_order_item_doc(row.item_code);
		if (!item_doc) {
			return;
		}

		const primary_uom = row.stock_uom || item_doc.stock_uom;

		if (row.required_uom !== primary_uom) {
			await frappe.model.set_value(cdt, cdn, "required_uom", primary_uom);
		}

		const secondary_uoms = (item_doc.uoms || []).filter(u => u.uom !== primary_uom);

		if (secondary_uoms.length === 0) {
			await clear_work_order_secondary_fields(frm, cdt, cdn);
			return;
		}

		const secondary_row = secondary_uoms[0];
		const required_qty = flt(row.required_qty) || 0;
		const conversion_factor = flt(secondary_row.conversion_factor) || 1;

		// Divide to convert to larger UOM (e.g., Meter to Kg)
		const secondary_qty = required_qty / conversion_factor;

		if (row.secondary_uom !== secondary_row.uom) {
			await frappe.model.set_value(cdt, cdn, "secondary_uom", secondary_row.uom);
		}

		if (row.secondary_qty !== secondary_qty) {
			await frappe.model.set_value(cdt, cdn, "secondary_qty", secondary_qty);
		}

		if (frm.fields_dict && frm.fields_dict.required_items) {
			const grid = frm.fields_dict.required_items.grid;
			const grid_row = grid.grid_rows_by_docname[cdn];
			if (grid_row) {
				grid_row.refresh_field("required_uom");
				grid_row.refresh_field("secondary_uom");
				grid_row.refresh_field("secondary_qty");
			}
		}

	} catch (error) {
		// Silently handle errors
	}
}

async function clear_work_order_secondary_fields(frm, cdt, cdn) {
	try {
		await frappe.model.set_value(cdt, cdn, "secondary_uom", null);
		await frappe.model.set_value(cdt, cdn, "secondary_qty", 0);

		if (frm.fields_dict && frm.fields_dict.required_items) {
			const grid = frm.fields_dict.required_items.grid;
			const grid_row = grid.grid_rows_by_docname[cdn];
			if (grid_row) {
				grid_row.refresh_field("secondary_uom");
				grid_row.refresh_field("secondary_qty");
			}
		}
	} catch (error) {
		// Silently handle errors
	}
}

async function get_work_order_item_doc(item_code) {
	if (!item_code) {
		return null;
	}

	if (!wo_item_doc_cache[item_code]) {
		try {
			wo_item_doc_cache[item_code] = await frappe.db.get_doc("Item", item_code);
		} catch (error) {
			return null;
		}
	}

	return wo_item_doc_cache[item_code];
}