let updating = false;

frappe.ui.form.on("Delivery Note Item", {

    item_code(frm, cdt, cdn) {
        set_secondary_fields(frm, cdt, cdn);
    },

    qty(frm, cdt, cdn) {
        // update secondary qty when qty changes
        set_secondary_fields(frm, cdt, cdn);
    },

    secondary_uom(frm, cdt, cdn) {
        update_from_primary(frm, cdt, cdn);
    },

    secondary_qty(frm, cdt, cdn) {
        update_from_secondary(frm, cdt, cdn);
    }
});


function set_secondary_fields(frm, cdt, cdn) {
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

            // set secondary_uom
            frappe.model.set_value(cdt, cdn, "secondary_uom", sec.uom);

            // qty fallback: if 0/undefined/null, ERPNext default is 1
            let qty = (row.qty === null || row.qty === undefined || row.qty === 0) ? 1 : row.qty;

            // set secondary_qty
            frappe.model.set_value(cdt, cdn, "secondary_qty", qty * sec.conversion_factor);
        }
    });
}


function update_from_primary(frm, cdt, cdn) {
    if (updating) return;
    updating = true;

    let row = locals[cdt][cdn];

    if (!row.item_code || row.qty === null || row.qty === undefined) {
        updating = false;
        return;
    }

    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Item",
            name: row.item_code
        },
        callback(r) {
            if (!r.message) {
                updating = false;
                return;
            }

            let uom = r.message.uoms.find(
                u => u.uom === row.secondary_uom
            );

            if (!uom) {
                updating = false;
                return;
            }

            frappe.model.set_value(
                cdt,
                cdn,
                "secondary_qty",
                row.qty * uom.conversion_factor
            );

            updating = false;
        }
    });
}



function set_secondary_uom(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    if (!row.item_code) return;

    frappe.call({
        method: "frappe.client.get",
        args: { doctype: "Item", name: row.item_code },
        callback(r) {
            if (!r.message) return;

            let item = r.message;
            let sec = item.uoms.find(u => u.uom !== item.stock_uom);

            if (sec) {
                frappe.model.set_value(cdt, cdn, "secondary_uom", sec.uom);
            }
        }
    });
}

function calculate_secondary_qty(frm, cdt, cdn) {
    if (updating) return;
    updating = true;

    let row = locals[cdt][cdn];
    if (!row.item_code || !row.secondary_uom) {
        updating = false;
        return;
    }

    let qty = (row.qty === null || row.qty === undefined) ? 0 : row.qty;

    frappe.call({
        method: "frappe.client.get",
        args: { doctype: "Item", name: row.item_code },
        callback(r) {
            if (!r.message) {
                updating = false;
                return;
            }

            let uom = r.message.uoms.find(u => u.uom === row.secondary_uom);
            if (!uom) {
                updating = false;
                return;
            }

            frappe.model.set_value(
                cdt,
                cdn,
                "secondary_qty",
                flt(qty) * flt(uom.conversion_factor)
            );

            updating = false;
        }
    });
}



frappe.ui.form.on("Sales Order Item", {

    item_code(frm, cdt, cdn) {
        set_secondary_fields(frm, cdt, cdn);
    },

    qty(frm, cdt, cdn) {
        // update secondary qty when qty changes
        set_secondary_fields(frm, cdt, cdn);
    }

});


function set_secondary_fields(frm, cdt, cdn) {
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

            // set secondary_uom
            frappe.model.set_value(cdt, cdn, "secondary_uom", sec.uom);

            // qty fallback: if 0/undefined/null, ERPNext default is 1
            let qty = (row.qty === null || row.qty === undefined || row.qty === 0) ? 1 : row.qty;

            // set secondary_qty
            frappe.model.set_value(cdt, cdn, "secondary_qty", qty * sec.conversion_factor);
        }
    });
}


function update_from_primary(frm, cdt, cdn) {
    if (updating) return;
    updating = true;

    let row = locals[cdt][cdn];

    if (!row.item_code || row.qty === null || row.qty === undefined) {
        updating = false;
        return;
    }

    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Item",
            name: row.item_code
        },
        callback(r) {
            if (!r.message) {
                updating = false;
                return;
            }

            let uom = r.message.uoms.find(
                u => u.uom === row.secondary_uom
            );

            if (!uom) {
                updating = false;
                return;
            }

            frappe.model.set_value(
                cdt,
                cdn,
                "secondary_qty",
                row.qty * uom.conversion_factor
            );

            updating = false;
        }
    });
}


function update_from_secondary(frm, cdt, cdn) {
    if (updating) return;
    updating = true;

    let row = locals[cdt][cdn];

    if (
        !row.item_code ||
        row.secondary_qty === null ||
        row.secondary_qty === undefined ||
        !row.secondary_uom
    ) {
        updating = false;
        return;
    }

    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Item",
            name: row.item_code
        },
        callback(r) {
            if (!r.message) {
                updating = false;
                return;
            }

            let uom = r.message.uoms.find(
                u => u.uom === row.secondary_uom
            );

            if (!uom) {
                updating = false;
                return;
            }

            frappe.model.set_value(
                cdt,
                cdn,
                "qty",
                row.secondary_qty / uom.conversion_factor
            );

            updating = false;
        }
    });
}
