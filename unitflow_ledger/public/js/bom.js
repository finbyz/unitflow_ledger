const bom_item_doc_cache = {};

frappe.ui.form.on("BOM", {
    // refresh(frm) {
    //     setTimeout(() => {
    //         recalculate_bom_rows(frm);
    //     }, 500);
    // },

    after_save(frm) {
        recalculate_bom_rows(frm);
    }
});

frappe.ui.form.on("BOM Item", {
    item_code: function (frm, cdt, cdn) {
        setTimeout(() => {
            update_bom_secondary_fields(frm, cdt, cdn).then(() => {
                frm.refresh_field("items");
            });
        }, 300);
    },

    qty: function (frm, cdt, cdn) {
        update_bom_secondary_fields(frm, cdt, cdn).then(() => {
            frm.refresh_field("items");
        });
    },

    uom: function (frm, cdt, cdn) {
        update_bom_secondary_fields(frm, cdt, cdn).then(() => {
            frm.refresh_field("items");
        });
    }
});

async function recalculate_bom_rows(frm) {
    if (!frm.doc.items || !frm.doc.items.length) {
        return;
    }

    for (const row of frm.doc.items) {
        await update_bom_secondary_fields(frm, row.doctype, row.name);
    }

    frm.refresh_field("items");
}

async function update_bom_secondary_fields(frm, cdt, cdn) {
    const row = locals[cdt] && locals[cdt][cdn];
    if (!row) {
        return;
    }

    try {
        if (!row.item_code) {
            await clear_secondary_fields(frm, cdt, cdn);
            return;
        }

        const item_doc = await get_bom_item_doc(row.item_code);
        if (!item_doc) {
            return;
        }

        const primary_uom = row.uom || item_doc.stock_uom;
        const secondary_uoms = (item_doc.uoms || []).filter(u => u.uom !== primary_uom);

        if (secondary_uoms.length === 0) {
            await clear_secondary_fields(frm, cdt, cdn);
            return;
        }

        const secondary_row = secondary_uoms[0];
        const qty = flt(row.qty) || 0;
        const conversion_factor = flt(secondary_row.conversion_factor) || 1;
        const secondary_qty = qty / conversion_factor;

        if (row.secondary_uom !== secondary_row.uom) {
            await frappe.model.set_value(cdt, cdn, "secondary_uom", secondary_row.uom);
        }

        if (row.secondary_qty !== secondary_qty) {
            await frappe.model.set_value(cdt, cdn, "secondary_qty", secondary_qty);
        }

        if (frm.fields_dict && frm.fields_dict.items) {
            const grid = frm.fields_dict.items.grid;
            const grid_row = grid.grid_rows_by_docname[cdn];
            if (grid_row) {
                grid_row.refresh_field("secondary_uom");
                grid_row.refresh_field("secondary_qty");
            }
        }

    } catch (error) {
        // Silently handle errors in production
    }
}

async function clear_secondary_fields(frm, cdt, cdn) {
    try {
        await frappe.model.set_value(cdt, cdn, "secondary_uom", null);
        await frappe.model.set_value(cdt, cdn, "secondary_qty", 0);

        if (frm.fields_dict && frm.fields_dict.items) {
            const grid = frm.fields_dict.items.grid;
            const grid_row = grid.grid_rows_by_docname[cdn];
            if (grid_row) {
                grid_row.refresh_field("secondary_uom");
                grid_row.refresh_field("secondary_qty");
            }
        }
    } catch (error) {
        // Silently handle errors in production
    }
}

async function get_bom_item_doc(item_code) {
    if (!item_code) {
        return null;
    }

    if (!bom_item_doc_cache[item_code]) {
        try {
            bom_item_doc_cache[item_code] = await frappe.db.get_doc("Item", item_code);
        } catch (error) {
            return null;
        }
    }

    return bom_item_doc_cache[item_code];
}