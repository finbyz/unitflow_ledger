let quot_updating = false;

frappe.ui.form.on("Quotation Item", {

    item_code(frm, cdt, cdn) {
        set_quot_secondary_fields(frm, cdt, cdn);
    },

    qty(frm, cdt, cdn) {
        quot_update_from_primary(frm, cdt, cdn);
    },

    secondary_uom(frm, cdt, cdn) {
        quot_update_from_primary(frm, cdt, cdn);
    },

    secondary_qty(frm, cdt, cdn) {
        quot_update_from_secondary(frm, cdt, cdn);
    },

    secondary_conversion_factor(frm, cdt, cdn) {
        if (quot_updating) return;
        quot_update_on_factor_change(frm, cdt, cdn);
    }
});

function set_quot_secondary_fields(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    if (!row.item_code) return;

    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Item",
            name: row.item_code
        },
        callback(r) {
            if (!r.message) return;

            let item = r.message;

            let sec = item.uoms.find(u => u.uom !== item.stock_uom);
            if (!sec) return;

            quot_updating = true;

            frappe.model.set_value(cdt, cdn, "secondary_uom", sec.uom);
            frappe.model.set_value(cdt, cdn, "secondary_conversion_factor", sec.conversion_factor);

            let qty = (row.qty === null || row.qty === undefined || row.qty === 0) ? 1 : row.qty;
            frappe.model.set_value(cdt, cdn, "secondary_qty", qty / sec.conversion_factor);

            quot_updating = false;
        }
    });
}

function quot_update_from_primary(frm, cdt, cdn) {
    if (quot_updating) return;
    quot_updating = true;

    let row = locals[cdt][cdn];

    if (!row.item_code || row.qty == null) {
        quot_updating = false;
        return;
    }

    let factor = row.secondary_conversion_factor;
    if (!factor) {
        quot_updating = false;
        return;
    }

    frappe.model.set_value(
        cdt,
        cdn,
        "secondary_qty",
        row.qty / factor
    );

    quot_updating = false;
}

function quot_update_from_secondary(frm, cdt, cdn) {
    if (quot_updating) return;
    quot_updating = true;

    let row = locals[cdt][cdn];

    if (!row.item_code || row.secondary_qty == null) {
        quot_updating = false;
        return;
    }

    let factor = row.secondary_conversion_factor;
    if (!factor) {
        quot_updating = false;
        return;
    }

    frappe.model.set_value(
        cdt,
        cdn,
        "qty",
        row.secondary_qty * factor
    );

    quot_updating = false;
}

function quot_update_on_factor_change(frm, cdt, cdn) {
    if (quot_updating) return;
    quot_updating = true;

    let r = locals[cdt][cdn];
    let factor = r.secondary_conversion_factor;

    if (!factor) {
        quot_updating = false;
        return;
    }

    if (r.qty != null) {
        frappe.model.set_value(
            cdt, cdn,
            "secondary_qty",
            r.qty / factor
        );
    } else if (r.secondary_qty != null) {
        frappe.model.set_value(
            cdt, cdn,
            "qty",
            r.secondary_qty * factor
        );
    }

    quot_updating = false;
}
