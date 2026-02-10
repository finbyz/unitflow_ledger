let updating = false;

frappe.ui.form.on("Purchase Invoice Item", {

    item_code(frm, cdt, cdn) {
        set_secondary_fields_pi(frm, cdt, cdn);
    },

    qty(frm, cdt, cdn) {
        update_from_primary_pi(frm, cdt, cdn);
    },

    secondary_uom(frm, cdt, cdn) {
        update_from_primary_pi(frm, cdt, cdn);
    },

    secondary_qty(frm, cdt, cdn) {
        update_from_secondary_pi(frm, cdt, cdn);
    },

    secondary_conversion_factor(frm, cdt, cdn) {
        if (updating) return;
        update_on_factor_change_pi(frm, cdt, cdn);
    }
});


function set_secondary_fields_pi(frm, cdt, cdn) {
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

            // pick first non-stock UOM
            let sec = item.uoms.find(u => u.uom !== item.stock_uom);
            if (!sec) return;

            updating = true;

            // set secondary_uom and conversion factor
            frappe.model.set_value(cdt, cdn, "secondary_uom", sec.uom);
            frappe.model.set_value(cdt, cdn, "secondary_conversion_factor", sec.conversion_factor);

            // qty fallback: if 0/undefined/null, ERPNext default is 1
            let qty = (row.qty === null || row.qty === undefined || row.qty === 0) ? 1 : row.qty;

            // Calculate secondary_qty
            // Formula: secondary_qty = qty / conversion_factor
            frappe.model.set_value(cdt, cdn, "secondary_qty", qty / sec.conversion_factor);

            updating = false;
        }
    });
}


function update_from_primary_pi(frm, cdt, cdn) {
    if (updating) return;
    updating = true;

    let row = locals[cdt][cdn];

    if (!row.item_code || row.qty === null || row.qty === undefined) {
        updating = false;
        return;
    }

    if (!row.secondary_conversion_factor) {
        updating = false;
        return;
    }

    // Formula: secondary_qty = qty / conversion_factor
    frappe.model.set_value(
        cdt,
        cdn,
        "secondary_qty",
        row.qty / row.secondary_conversion_factor
    );

    updating = false;
}


function update_from_secondary_pi(frm, cdt, cdn) {
    if (updating) return;
    updating = true;

    let row = locals[cdt][cdn];

    if (!row.item_code || row.secondary_qty === null || row.secondary_qty === undefined) {
        updating = false;
        return;
    }

    if (!row.secondary_conversion_factor) {
        updating = false;
        return;
    }

    // Formula: qty = secondary_qty * conversion_factor
    frappe.model.set_value(
        cdt,
        cdn,
        "qty",
        row.secondary_qty * row.secondary_conversion_factor
    );

    updating = false;
}


function update_on_factor_change_pi(frm, cdt, cdn) {
    if (updating) return;
    updating = true;

    let r = locals[cdt][cdn];
    let factor = r.secondary_conversion_factor;

    if (!factor) {
        updating = false;
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

    updating = false;
}