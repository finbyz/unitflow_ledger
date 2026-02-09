let updating = false;


frappe.ui.form.on("Sales Order Item", {

    item_code(frm, cdt, cdn) {
        set_secondary_fields(frm, cdt, cdn);
    },

    qty(frm, cdt, cdn) {
        // update secondary qty when qty changes
        let row = locals[cdt][cdn];
        if (!row.secondary_conversion_factor || !row.secondary_uom) {
            set_secondary_fields(frm, cdt, cdn);
            return;
        }
        update_from_primary(frm, cdt, cdn);
    },
    secondary_uom(frm, cdt, cdn) {
        update_from_primary(frm, cdt, cdn);
    },

    secondary_qty(frm, cdt, cdn) {
        update_from_secondary(frm, cdt, cdn);
    },
    secondary_conversion_factor(frm, cdt, cdn) {
        if (updating) return;
        update_on_factor_change(frm, cdt, cdn);
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
            frappe.model.set_value(cdt, cdn, "secondary_conversion_factor", sec.conversion_factor);

        }
    });
}


// function update_from_primary(frm, cdt, cdn) {
//     if (updating) return;
//     updating = true;

//     let row = locals[cdt][cdn];

//     if (!row.item_code || row.qty === null || row.qty === undefined) {
//         updating = false;
//         return;
//     }

//     frappe.call({
//         method: "frappe.client.get",
//         args: {
//             doctype: "Item",
//             name: row.item_code
//         },
//         callback(r) {
//             if (!r.message) {
//                 updating = false;
//                 return;
//             }

//             let uom = r.message.uoms.find(
//                 u => u.uom === row.secondary_uom
//             );

//             if (!uom) {
//                 updating = false;
//                 return;
//             }

//             frappe.model.set_value(
//                 cdt,
//                 cdn,
//                 "secondary_qty",
//                 row.qty * uom.conversion_factor
//             );

//             updating = false;
//         }
//     });
// }

function update_from_primary(frm, cdt, cdn) {
    if (updating) return;
    updating = true;

    let row = locals[cdt][cdn];

    if (!row.item_code || row.qty == null) {
        updating = false;
        return;
    }

    let factor = row.secondary_conversion_factor;
    if (!factor) {
        updating = false;
        return;
    }

    frappe.model.set_value(
        cdt,
        cdn,
        "secondary_qty",
        row.qty * factor
    );

    updating = false;
}



// function update_from_secondary(frm, cdt, cdn) {
//     if (updating) return;
//     updating = true;

//     let row = locals[cdt][cdn];

//     if (
//         !row.item_code ||
//         row.secondary_qty === null ||
//         row.secondary_qty === undefined ||
//         !row.secondary_uom
//     ) {
//         updating = false;
//         return;
//     }

//     frappe.call({
//         method: "frappe.client.get",
//         args: {
//             doctype: "Item",
//             name: row.item_code
//         },
//         callback(r) {
//             if (!r.message) {
//                 updating = false;
//                 return;
//             }

//             let uom = r.message.uoms.find(
//                 u => u.uom === row.secondary_uom
//             );

//             if (!uom) {
//                 updating = false;
//                 return;
//             }

//             frappe.model.set_value(
//                 cdt,
//                 cdn,
//                 "qty",
//                 row.secondary_qty / uom.conversion_factor
//             );

//             updating = false;
//         }
//     });
// }

function update_from_secondary(frm, cdt, cdn) {
    if (updating) return;
    updating = true;

    let row = locals[cdt][cdn];

    if (!row.item_code || row.secondary_qty == null) {
        updating = false;
        return;
    }

    let factor = row.secondary_conversion_factor;
    if (!factor) {
        updating = false;
        return;
    }

    frappe.model.set_value(
        cdt,
        cdn,
        "qty",
        row.secondary_qty / factor
    );

    updating = false;
}


function update_secondary_qty(frm, cdt, cdn) {
    if (updating) return;
    updating = true;

    let r = locals[cdt][cdn];
    if (!r.secondary_conversion_factor) {
        updating = false;
        return;
    }

    frappe.model.set_value(
        cdt, cdn,
        "secondary_qty",
        r.qty * r.secondary_conversion_factor
    );

    updating = false;
}

function update_primary_qty(frm, cdt, cdn) {
    if (updating) return;
    updating = true;

    let r = locals[cdt][cdn];
    if (!r.secondary_conversion_factor) {
        updating = false;
        return;
    }

    frappe.model.set_value(
        cdt, cdn,
        "qty",
        r.secondary_qty / r.secondary_conversion_factor
    );

    updating = false;
}


function update_on_factor_change(frm, cdt, cdn) {
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
            r.qty * factor
        );
    } else if (r.secondary_qty != null) {
        frappe.model.set_value(
            cdt, cdn,
            "qty",
            r.secondary_qty / factor
        );
    }

    updating = false;
}


