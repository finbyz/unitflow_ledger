// let updating = false;
// const ITEM_DOC_CACHE = {};

// const HAS_SECONDARY_FACTOR_FIELD = frappe.meta.has_field(
//     "Stock Entry Detail",
//     "secondary_conversion_factor"
// );

// frappe.ui.form.on("Stock Entry Detail", {
//     item_code(frm, cdt, cdn) {
//         set_secondary_fields_se(cdt, cdn);
//     },

//     qty(frm, cdt, cdn) {
//         update_from_primary_se(cdt, cdn);
//     },

//     transfer_qty(frm, cdt, cdn) {
//         update_from_primary_se(cdt, cdn);
//     },

//     secondary_uom(frm, cdt, cdn) {
//         set_secondary_factor_from_uom(cdt, cdn);
//     },

//     secondary_qty(frm, cdt, cdn) {
//         update_from_secondary_se(cdt, cdn);
//     },

//     secondary_conversion_factor(frm, cdt, cdn) {
//         if (!HAS_SECONDARY_FACTOR_FIELD || updating) return;
//         update_on_factor_change_se(cdt, cdn);
//     }
// });


// function queue_secondary_recalc(frm) {
//     clearTimeout(frm.__se_secondary_recalc_timer);
//     frm.__se_secondary_recalc_timer = setTimeout(() => {
//         recalculate_secondary_for_all_items(frm);
//     }, 500);
// }

// function get_effective_factor(row) {
//     if (!row) return 0;
//     return flt(row.secondary_conversion_factor || row.__secondary_conversion_factor);
// }

// async function fetch_item_doc(item_code) {
//     if (!item_code) return null;
//     if (!ITEM_DOC_CACHE[item_code]) {
//         ITEM_DOC_CACHE[item_code] = frappe.db.get_doc("Item", item_code);
//     }
//     return ITEM_DOC_CACHE[item_code];
// }

// async function set_secondary_fields_se(cdt, cdn) {
//     const row = locals[cdt][cdn];
//     if (!row?.item_code || updating) return;

//     const item = await fetch_item_doc(row.item_code);
//     if (!item) return;

//     const chosen_uom = row.secondary_uom || null;
//     let secondary_row = (item.uoms || []).find((u) => u.uom === chosen_uom);
//     if (!secondary_row) {
//         secondary_row = (item.uoms || []).find((u) => u.uom !== item.stock_uom);
//     }
//     if (!secondary_row) return;

//     const factor = flt(secondary_row.conversion_factor);
//     if (!factor) return;

//     updating = true;
//     try {
//         await frappe.model.set_value(cdt, cdn, "secondary_uom", secondary_row.uom);
//         row.__secondary_conversion_factor = factor;
//         if (HAS_SECONDARY_FACTOR_FIELD) {
//             await frappe.model.set_value(cdt, cdn, "secondary_conversion_factor", factor);
//         }

//         const qty = row.qty == null ? 0 : flt(row.qty);
//         await frappe.model.set_value(cdt, cdn, "secondary_qty", qty / factor);
//     } finally {
//         updating = false;
//     }
// }

// async function set_secondary_factor_from_uom(cdt, cdn) {
//     const row = locals[cdt][cdn];
//     if (!row?.item_code || updating || !row.secondary_uom) return;

//     const item = await fetch_item_doc(row.item_code);
//     if (!item) return;

//     const secondary_row = (item.uoms || []).find((u) => u.uom === row.secondary_uom);
//     if (!secondary_row?.conversion_factor) return;

//     updating = true;
//     try {
//         const factor = flt(secondary_row.conversion_factor);
//         row.__secondary_conversion_factor = factor;
//         if (HAS_SECONDARY_FACTOR_FIELD) {
//             await frappe.model.set_value(cdt, cdn, "secondary_conversion_factor", factor);
//         }
//         await frappe.model.set_value(cdt, cdn, "secondary_qty", flt(row.qty || 0) / factor);
//     } finally {
//         updating = false;
//     }
// }

// function update_from_primary_se(cdt, cdn) {
//     if (updating) return;
//     const row = locals[cdt][cdn];
//     const factor = get_effective_factor(row);
//     if (!row?.item_code || row.qty == null || !factor) return;

//     updating = true;
//     frappe.model.set_value(cdt, cdn, "secondary_qty", flt(row.qty) / factor);
//     updating = false;
// }

// function update_from_secondary_se(cdt, cdn) {
//     if (updating) return;
//     const row = locals[cdt][cdn];
//     const factor = get_effective_factor(row);
//     if (!row?.item_code || row.secondary_qty == null || !factor) return;

//     updating = true;
//     frappe.model.set_value(cdt, cdn, "qty", flt(row.secondary_qty) * factor);
//     updating = false;
// }

// function update_on_factor_change_se(cdt, cdn) {
//     if (updating) return;
//     const row = locals[cdt][cdn];
//     const factor = get_effective_factor(row);
//     if (!factor) return;

//     updating = true;
//     row.__secondary_conversion_factor = factor;

//     if (row.qty != null) {
//         frappe.model.set_value(cdt, cdn, "secondary_qty", flt(row.qty) / factor);
//     } else if (row.secondary_qty != null) {
//         frappe.model.set_value(cdt, cdn, "qty", flt(row.secondary_qty) * factor);
//     }
//     updating = false;
// }

// async function recalculate_secondary_for_all_items(frm) {
//     for (const row of frm.doc.items || []) {
//         if (!row.item_code) continue;
//         await set_secondary_fields_se(row.doctype, row.name);
//     }
// }

let updating = false;
const ITEM_DOC_CACHE = {};

const HAS_SECONDARY_FACTOR_FIELD = frappe.meta.has_field(
    "Stock Entry Detail",
    "secondary_conversion_factor"
);


// CHILD TABLE EVENTS
frappe.ui.form.on("Stock Entry Detail", {

    item_code(frm, cdt, cdn) {
        set_secondary_fields_se(frm, cdt, cdn);
    },

    qty(frm, cdt, cdn) {
        update_from_primary_se(frm, cdt, cdn);
    },

    transfer_qty(frm, cdt, cdn) {
        update_from_primary_se(frm, cdt, cdn);
    },

    secondary_uom(frm, cdt, cdn) {
        set_secondary_factor_from_uom(frm, cdt, cdn);
    },

    secondary_qty(frm, cdt, cdn) {
        update_from_secondary_se(frm, cdt, cdn);
    },

    secondary_conversion_factor(frm, cdt, cdn) {
        if (!HAS_SECONDARY_FACTOR_FIELD || updating) return;
        update_on_factor_change_se(frm, cdt, cdn);
    }
});


// PARENT EVENTS
frappe.ui.form.on("Stock Entry", {

    refresh(frm) {
        queue_secondary_recalc(frm);
    },

    items_add(frm, cdt, cdn) {
        set_secondary_fields_se(frm, cdt, cdn);
    }

});


// ----------------------------------------------------
// UTILITIES
// ----------------------------------------------------

function queue_secondary_recalc(frm) {

    clearTimeout(frm.__se_secondary_recalc_timer);

    frm.__se_secondary_recalc_timer = setTimeout(() => {
        recalculate_secondary_for_all_items(frm);
    }, 400);

}


function get_effective_factor(row) {

    if (!row) return 0;

    return flt(row.secondary_conversion_factor || row.__secondary_conversion_factor);

}


async function fetch_item_doc(item_code) {

    if (!item_code) return null;

    if (!ITEM_DOC_CACHE[item_code]) {
        ITEM_DOC_CACHE[item_code] = frappe.db.get_doc("Item", item_code);
    }

    return ITEM_DOC_CACHE[item_code];

}


// ----------------------------------------------------
// CORE LOGIC
// ----------------------------------------------------

async function set_secondary_fields_se(frm, cdt, cdn) {

    const row = locals[cdt][cdn];

    if (!row?.item_code || updating) return;

    const item = await fetch_item_doc(row.item_code);

    if (!item) return;

    const chosen_uom = row.secondary_uom || null;

    let secondary_row = (item.uoms || []).find(u => u.uom === chosen_uom);

    if (!secondary_row) {
        secondary_row = (item.uoms || []).find(u => u.uom !== item.stock_uom);
    }

    if (!secondary_row) return;

    const factor = flt(secondary_row.conversion_factor);

    if (!factor) return;

    const is_opening = frm?.doc?.is_opening === "Yes";

    updating = true;

    try {

        await frappe.model.set_value(cdt, cdn, "secondary_uom", secondary_row.uom);

        row.__secondary_conversion_factor = factor;

        if (HAS_SECONDARY_FACTOR_FIELD) {
            await frappe.model.set_value(cdt, cdn, "secondary_conversion_factor", factor);
        }

        // Skip qty calculation for opening entries — qty is entered manually
        if (!is_opening) {
            const qty = flt(row.qty || 0);
            await frappe.model.set_value(cdt, cdn, "secondary_qty", qty / factor);
        }

    }

    finally {
        updating = false;
    }

}


async function set_secondary_factor_from_uom(frm, cdt, cdn) {

    const row = locals[cdt][cdn];

    if (!row?.item_code || updating || !row.secondary_uom) return;

    const item = await fetch_item_doc(row.item_code);

    if (!item) return;

    const secondary_row = (item.uoms || []).find(u => u.uom === row.secondary_uom);

    if (!secondary_row?.conversion_factor) return;

    const is_opening = frm?.doc?.is_opening === "Yes";

    updating = true;

    try {

        const factor = flt(secondary_row.conversion_factor);

        row.__secondary_conversion_factor = factor;

        if (HAS_SECONDARY_FACTOR_FIELD) {
            await frappe.model.set_value(cdt, cdn, "secondary_conversion_factor", factor);
        }

        // Skip qty calculation for opening entries — qty is entered manually
        if (!is_opening) {
            await frappe.model.set_value(cdt, cdn, "secondary_qty", flt(row.qty || 0) / factor);
        }

    }

    finally {
        updating = false;
    }

}


function update_from_primary_se(frm, cdt, cdn) {

    if (updating) return;

    // Skip recalculation for opening entries
    if (frm?.doc?.is_opening === "Yes") return;

    const row = locals[cdt][cdn];

    const factor = get_effective_factor(row);

    if (!row?.item_code || row.qty == null || !factor) return;

    updating = true;

    frappe.model.set_value(cdt, cdn, "secondary_qty", flt(row.qty) / factor);

    updating = false;

}


function update_from_secondary_se(frm, cdt, cdn) {

    if (updating) return;

    // Skip recalculation for opening entries
    if (frm?.doc?.is_opening === "Yes") return;

    const row = locals[cdt][cdn];

    const factor = get_effective_factor(row);

    if (!row?.item_code || row.secondary_qty == null || !factor) return;

    updating = true;

    frappe.model.set_value(cdt, cdn, "qty", flt(row.secondary_qty) * factor);

    updating = false;

}


function update_on_factor_change_se(frm, cdt, cdn) {

    if (updating) return;

    const row = locals[cdt][cdn];

    const factor = get_effective_factor(row);

    if (!factor) return;

    updating = true;

    row.__secondary_conversion_factor = factor;

    // Skip qty calculation for opening entries
    if (frm?.doc?.is_opening !== "Yes") {

        if (row.qty != null) {
            frappe.model.set_value(cdt, cdn, "secondary_qty", flt(row.qty) / factor);
        }

        else if (row.secondary_qty != null) {
            frappe.model.set_value(cdt, cdn, "qty", flt(row.secondary_qty) * factor);
        }

    }

    updating = false;

}


// ----------------------------------------------------
// MASS RECALCULATION
// ----------------------------------------------------

async function recalculate_secondary_for_all_items(frm) {

    for (const row of frm.doc.items || []) {

        if (!row.item_code) continue;

        await set_secondary_fields_se(frm, row.doctype, row.name);

    }

}