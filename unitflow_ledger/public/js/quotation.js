// let quot_updating = false;

// frappe.ui.form.on("Quotation Item", {
//     item_code(frm, cdt, cdn) {
//         set_quot_secondary_fields(frm, cdt, cdn);
//     },
//     qty(frm, cdt, cdn) {
//         quot_update_from_primary(frm, cdt, cdn);
//     },
//     secondary_uom(frm, cdt, cdn) {
//         quot_update_from_primary(frm, cdt, cdn);
//     },
//     secondary_qty(frm, cdt, cdn) {
//         quot_update_from_secondary(frm, cdt, cdn);
//     },
//     secondary_conversion_factor(frm, cdt, cdn) {
//         if (quot_updating) return;
//         quot_update_on_factor_change(frm, cdt, cdn);
//     },
//     form_render(frm, cdt, cdn) {
//         set_quot_secondary_fields_read_only(frm, cdt, cdn);
//     }
// });

// function set_quot_secondary_fields(frm, cdt, cdn) {
//     let row = locals[cdt][cdn];
//     if (!row.item_code) return;

//     frappe.call({
//         method: "frappe.client.get",
//         args: { doctype: "Item", name: row.item_code },
//         callback(r) {
//             if (!r.message) return;

//             let item = r.message;
//             let sec = item.uoms.find(u => u.uom !== item.stock_uom);
//             if (!sec) return;

//             quot_updating = true;

//             frappe.model.set_value(cdt, cdn, "secondary_uom", sec.uom);
//             frappe.model.set_value(cdt, cdn, "secondary_conversion_factor", sec.conversion_factor);

//             let qty = (!row.qty) ? 1 : row.qty;
//             frappe.model.set_value(cdt, cdn, "secondary_qty", qty / sec.conversion_factor);

//             quot_updating = false;
//         }
//     });
// }

// function quot_update_from_primary(frm, cdt, cdn) {
//     if (quot_updating) return;
//     quot_updating = true;

//     let row = locals[cdt][cdn];
//     if (!row.item_code || row.qty == null) { quot_updating = false; return; }

//     let factor = row.secondary_conversion_factor;
//     if (!factor) { quot_updating = false; return; }

//     frappe.model.set_value(cdt, cdn, "secondary_qty", row.qty / factor);
//     quot_updating = false;
// }

// function quot_update_from_secondary(frm, cdt, cdn) {
//     if (quot_updating) return;
//     quot_updating = true;

//     let row = locals[cdt][cdn];
//     if (!row.item_code || row.secondary_qty == null) { quot_updating = false; return; }

//     let factor = row.secondary_conversion_factor;
//     if (!factor) { quot_updating = false; return; }

//     frappe.model.set_value(cdt, cdn, "qty", row.secondary_qty * factor);
//     quot_updating = false;
// }

// function quot_update_on_factor_change(frm, cdt, cdn) {
//     if (quot_updating) return;
//     quot_updating = true;

//     let r = locals[cdt][cdn];
//     let factor = r.secondary_conversion_factor;
//     if (!factor) { quot_updating = false; return; }

//     if (r.qty != null) {
//         frappe.model.set_value(cdt, cdn, "secondary_qty", r.qty / factor);
//     } else if (r.secondary_qty != null) {
//         frappe.model.set_value(cdt, cdn, "qty", r.secondary_qty * factor);
//     }

//     quot_updating = false;
// }

// frappe.ui.form.on("Quotation", {
//     refresh(frm) {
//         set_quot_secondary_fields_read_only(frm);
//     },
//     onload(frm) {
//         set_quot_secondary_fields_read_only(frm);
//     }
// });

// function set_quot_secondary_fields_read_only(frm, cdt, cdn) {
//     // Only allow users with "Quotation Manager" role
//     const has_role = frappe.user_roles.includes("Quotation Manager");

//     if (!has_role) {
//         if (cdt && cdn) {
//             // Disable for specific row in the child table dialog
//             frm.fields_dict["items"].grid.grid_rows_by_docname[cdn]
//                 .toggle_enable("secondary_conversion_factor", false);
//         } else {
//             // Disable entire column in the grid
//             frm.fields_dict["items"].grid.toggle_enable("secondary_conversion_factor", false);
//             frm.refresh_field("items");
//         }
//     }
// }



let quot_updating = false;

// ─── Quotation form hooks ────────────────────────────────────────────────────

frappe.ui.form.on("Quotation", {
    refresh(frm) {
        patch_update_child_items_for_quotation(frm);
        set_quot_secondary_fields_read_only(frm);
    },
    onload(frm) {
        set_quot_secondary_fields_read_only(frm);
    },
});

// ─── Quotation Item child hooks ──────────────────────────────────────────────

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
    },
    form_render(frm, cdt, cdn) {
        set_quot_secondary_fields_read_only(frm, cdt, cdn);
    },
});

// ─── Inline secondary UOM helpers ────────────────────────────────────────────

function set_quot_secondary_fields(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    if (!row.item_code) return;

    frappe.call({
        method: "frappe.client.get",
        args: { doctype: "Item", name: row.item_code },
        callback(r) {
            if (!r.message) return;

            let item = r.message;
            let sec  = item.uoms.find(u => u.uom !== item.stock_uom);
            if (!sec) return;

            quot_updating = true;

            frappe.model.set_value(cdt, cdn, "secondary_uom", sec.uom);
            frappe.model.set_value(cdt, cdn, "secondary_conversion_factor", sec.conversion_factor);

            let qty = (!row.qty) ? 1 : row.qty;
            frappe.model.set_value(cdt, cdn, "secondary_qty", qty / sec.conversion_factor);

            quot_updating = false;
        },
    });
}

function quot_update_from_primary(frm, cdt, cdn) {
    if (quot_updating) return;
    quot_updating = true;

    let row = locals[cdt][cdn];
    if (!row.item_code || row.qty == null) { quot_updating = false; return; }

    let factor = row.secondary_conversion_factor;
    if (!factor) { quot_updating = false; return; }

    frappe.model.set_value(cdt, cdn, "secondary_qty", row.qty / factor);
    quot_updating = false;
}

function quot_update_from_secondary(frm, cdt, cdn) {
    if (quot_updating) return;
    quot_updating = true;

    let row = locals[cdt][cdn];
    if (!row.item_code || row.secondary_qty == null) { quot_updating = false; return; }

    let factor = row.secondary_conversion_factor;
    if (!factor) { quot_updating = false; return; }

    frappe.model.set_value(cdt, cdn, "qty", row.secondary_qty * factor);
    quot_updating = false;
}

function quot_update_on_factor_change(frm, cdt, cdn) {
    if (quot_updating) return;
    quot_updating = true;

    let r      = locals[cdt][cdn];
    let factor = r.secondary_conversion_factor;
    if (!factor) { quot_updating = false; return; }

    if (r.qty != null) {
        frappe.model.set_value(cdt, cdn, "secondary_qty", r.qty / factor);
    } else if (r.secondary_qty != null) {
        frappe.model.set_value(cdt, cdn, "qty", r.secondary_qty * factor);
    }

    quot_updating = false;
}

// ─── Role-based read-only for secondary_conversion_factor ───────────────────

function set_quot_secondary_fields_read_only(frm, cdt, cdn) {
    const has_role = frappe.user_roles.includes("Quotation Manager");

    if (!has_role) {
        if (cdt && cdn) {
            frm.fields_dict["items"].grid.grid_rows_by_docname[cdn]
               .toggle_enable("secondary_conversion_factor", false);
        } else {
            frm.fields_dict["items"].grid.toggle_enable("secondary_conversion_factor", false);
            frm.refresh_field("items");
        }
    }
}

// ─── Patch: Update Items dialog for Quotation ────────────────────────────────

function patch_update_child_items_for_quotation(frm) {
    if (frm.doc.doctype !== "Quotation") return;
    if (erpnext.utils._quot_secondary_patched) return;
    erpnext.utils._quot_secondary_patched = true;

    const _original = erpnext.utils.update_child_items.bind(erpnext.utils);

    erpnext.utils.update_child_items = function (opts) {
        const frm = opts.frm;

        if (frm.doc.doctype !== "Quotation") {
            return _original(opts);
        }

        const cannot_add_row = opts.cannot_add_row !== undefined ? opts.cannot_add_row : true;
        const child_docname  = opts.child_docname || "items";
        const child_meta     = frappe.get_meta("Quotation Item");

        const get_precision = (fieldname) => {
            const f = child_meta.fields.find(f => f.fieldname === fieldname);
            return f ? f.precision : 2;
        };

        // ── Build row data ────────────────────────────────────────────────────
        const data = frm.doc[child_docname].map(d => ({
            docname:                     d.name,
            name:                        d.name,
            item_code:                   d.item_code,
            item_name:                   d.item_name,
            qty:                         d.qty,
            uom:                         d.uom,
            conversion_factor:           d.conversion_factor,
            price_list_rate:             d.price_list_rate,
            secondary_uom:               d.secondary_uom               || "",
            secondary_qty:               d.secondary_qty               || 0,
            secondary_conversion_factor: d.secondary_conversion_factor || 0,
            description:                 d.description,
        }));

        // ── Back-fill secondary_uom from Item master where missing ────────────
        const rows_needing_sec = data.filter(d => d.item_code && !d.secondary_uom);

        const fill_promises = rows_needing_sec.map(row =>
            frappe.db.get_doc("Item", row.item_code).then(item_doc => {
                const sec = (item_doc.uoms || []).find(u => u.uom !== item_doc.stock_uom);
                if (sec) {
                    row.secondary_uom               = sec.uom;
                    row.secondary_conversion_factor = flt(sec.conversion_factor);
                    row.secondary_qty               = flt(row.qty) / (flt(sec.conversion_factor) || 1);
                }
            })
        );

        // Wait for all back-fills then show the dialog
        Promise.all(fill_promises).then(() => open_quot_dialog(frm, data, fields_builder()));

        // ── Field definitions ─────────────────────────────────────────────────
        function fields_builder() {
            return [
                {
                    fieldtype: "Data",
                    fieldname: "docname",
                    read_only: 1,
                    hidden:    1,
                },

                // ── Item Code ────────────────────────────────────────────────
                {
                    fieldtype:    "Link",
                    fieldname:    "item_code",
                    options:      "Item",
                    in_list_view: 1,
                    read_only:    0,
                    label:        __("Item Code"),
                    get_query: () => ({
                        query:   "erpnext.controllers.queries.item_query",
                        filters: { is_sales_item: 1 },
                    }),
                    onchange: function () {
                        const me = this;
                        if (!this.value) return;

                        frm.call({
                            method: "erpnext.stock.get_item_details.get_item_details",
                            args: {
                                doc: frm.doc,
                                ctx: {
                                    item_code:     this.value,
                                    company:       frm.doc.company,
                                    customer:      frm.doc.party_name || frm.doc.customer,
                                    currency:      frm.doc.currency,
                                    price_list:    frm.doc.selling_price_list,
                                    doctype:       frm.doc.doctype,
                                    name:          frm.doc.name,
                                    qty:           me.doc.qty || 1,
                                    child_doctype: "Quotation Item",
                                },
                            },
                            callback(r) {
                                if (!r.message) return;
                                const d   = r.message;
                                const row = dialog.fields_dict.trans_items.df.data
                                                  .find(row => row.name === me.doc.name);
                                if (!row) return;

                                Object.assign(row, {
                                    item_name:         d.item_name,
                                    uom:               d.uom,
                                    conversion_factor: d.conversion_factor,
                                    qty:               me.doc.qty || 1,
                                    price_list_rate:   d.price_list_rate || 0,
                                    description:       d.description,
                                });

                                frappe.db.get_doc("Item", me.value).then(item_doc => {
                                    const sec = (item_doc.uoms || []).find(u => u.uom !== d.uom);
                                    if (sec) {
                                        row.secondary_uom               = sec.uom;
                                        row.secondary_conversion_factor = flt(sec.conversion_factor);
                                        row.secondary_qty               = flt(row.qty) / (flt(sec.conversion_factor) || 1);
                                    }
                                    dialog.fields_dict.trans_items.grid.refresh();
                                });
                            },
                        });
                    },
                },

                // ── Item Name ────────────────────────────────────────────────
                {
                    fieldtype: "Data",
                    fieldname: "item_name",
                    label:     __("Item Name"),
                    read_only: 1,
                },

                // ── UOM ──────────────────────────────────────────────────────
                {
                    fieldtype:    "Link",
                    fieldname:    "uom",
                    options:      "UOM",
                    in_list_view: 1,
                    read_only:    0,
                    reqd:         1,
                    label:        __("UOM"),
                    onchange: function () {
                        const me          = this;
                        const item_code   = me.doc.item_code;
                        const primary_uom = me.value;
                        if (!item_code || !primary_uom) return;

                        frappe.call({
                            method: "erpnext.stock.get_item_details.get_conversion_factor",
                            args:   { item_code, uom: primary_uom },
                            callback(r) {
                                if (r.exc || !r.message) return;
                                const row = dialog.fields_dict.trans_items.df.data
                                                  .find(r => r.name === me.doc.name);
                                if (!row) return;
                                row.conversion_factor = r.message.conversion_factor;

                                frappe.db.get_doc("Item", item_code).then(item_doc => {
                                    const sec = (item_doc.uoms || []).find(u => u.uom !== primary_uom);
                                    if (sec) {
                                        row.secondary_uom               = sec.uom;
                                        row.secondary_conversion_factor = flt(sec.conversion_factor);
                                        row.secondary_qty               = flt(row.qty) / (flt(sec.conversion_factor) || 1);
                                    }
                                    dialog.fields_dict.trans_items.grid.refresh();
                                });
                            },
                        });
                    },
                },

                // ── Conversion Factor (payload only, not in list view) ────────
                {
                    fieldtype: "Float",
                    fieldname: "conversion_factor",
                    label:     __("Conversion Factor"),
                    precision: get_precision("conversion_factor"),
                },

                // ── Qty ──────────────────────────────────────────────────────
                {
                    fieldtype:    "Float",
                    fieldname:    "qty",
                    default:      0,
                    in_list_view: 1,
                    read_only:    0,
                    label:        __("Qty"),
                    precision:    get_precision("qty"),
                    onchange: function () {
                        const me  = this;
                        const row = dialog.fields_dict.trans_items.df.data
                                          .find(r => r.name === me.doc.name);
                        if (row && flt(row.secondary_conversion_factor)) {
                            row.secondary_qty = flt(me.value) / flt(row.secondary_conversion_factor);
                            dialog.fields_dict.trans_items.grid.refresh();
                        }
                    },
                },

                // ── Price List Rate ──────────────────────────────────────────
                {
                    fieldtype:    "Currency",
                    fieldname:    "price_list_rate",
                    options:      "currency",
                    in_list_view: 1,
                    label:        __("Price List Rate"),
                    precision:    get_precision("price_list_rate"),
                    onchange: function () {
                        const me  = this;
                        const row = dialog.fields_dict.trans_items.df.data
                                          .find(r => r.name === me.doc.name);
                        if (!row) return;
                        // rate = price_list_rate directly (no discount)
                        row.rate = flt(me.value);
                        dialog.fields_dict.trans_items.grid.refresh();
                    },
                },

                // ── Secondary UOM ────────────────────────────────────────────
                {
                    fieldtype:    "Link",
                    fieldname:    "secondary_uom",
                    options:      "UOM",
                    in_list_view: 1,
                    read_only:    0,
                    label:        __("Sec UOM"),
                    onchange: function () {
                        const me          = this;
                        const item_code   = me.doc.item_code;
                        const new_sec_uom = me.value;
                        if (!item_code || !new_sec_uom) return;

                        frappe.db.get_doc("Item", item_code).then(item_doc => {
                            const sec = (item_doc.uoms || []).find(u => u.uom === new_sec_uom);
                            const row = dialog.fields_dict.trans_items.df.data
                                              .find(r => r.name === me.doc.name);
                            if (!row) return;
                            row.secondary_conversion_factor = sec ? flt(sec.conversion_factor) : 0;
                            row.secondary_qty = (sec && flt(sec.conversion_factor))
                                ? flt(row.qty) / flt(sec.conversion_factor) : 0;
                            dialog.fields_dict.trans_items.grid.refresh();
                        });
                    },
                },

                // ── Secondary Qty ────────────────────────────────────────────
                {
                    fieldtype:    "Float",
                    fieldname:    "secondary_qty",
                    default:      0,
                    in_list_view: 1,
                    read_only:    0,
                    label:        __("Sec Qty"),
                    precision:    get_precision("secondary_qty"),
                    onchange: function () {
                        const me  = this;
                        const row = dialog.fields_dict.trans_items.df.data
                                          .find(r => r.name === me.doc.name);
                        if (row && flt(row.secondary_conversion_factor)) {
                            row.qty = flt(me.value) * flt(row.secondary_conversion_factor);
                            dialog.fields_dict.trans_items.grid.refresh();
                        }
                    },
                },

                // ── Secondary Conversion Factor (read-only) ──────────────────
                {
                    fieldtype:    "Float",
                    fieldname:    "secondary_conversion_factor",
                    default:      0,
                    in_list_view: 1,
                    read_only:    1,
                    label:        __("Sec Conv Factor"),
                    precision:    get_precision("secondary_conversion_factor"),
                },

                // ── Description ──────────────────────────────────────────────
                {
                    fieldtype: "Text Editor",
                    fieldname: "description",
                    read_only: 0,
                    label:     __("Description"),
                },
            ];
        }
    };

    // ── Open the dialog ───────────────────────────────────────────────────────
    function open_quot_dialog(frm, data, fields) {
        const child_docname = "items";

        let dialog = new frappe.ui.Dialog({
            title:  __("Update Items"),
            size:   "extra-large",
            fields: [{
                fieldname:       "trans_items",
                fieldtype:       "Table",
                label:           "Items",
                cannot_add_rows: false,
                in_place_edit:   false,
                reqd:            1,
                data,
                get_data:        () => data,
                fields,
            }],

            primary_action: function () {
                this.update_items();
            },

            update_items: function () {
                const trans_items = this.get_values()["trans_items"]
                    .filter(item => !!item.item_code);

                trans_items.forEach(row => {
                    // rate = price_list_rate directly (no discount)
                    row.rate                        = flt(row.price_list_rate           || 0);
                    row.qty                         = flt(row.qty                       || 0);
                    row.conversion_factor           = flt(row.conversion_factor         || 1);
                    row.secondary_qty               = flt(row.secondary_qty             || 0);
                    row.secondary_conversion_factor = flt(row.secondary_conversion_factor || 0);
                });

                frappe.call({
                    method: "erpnext.controllers.accounts_controller.update_child_qty_rate",
                    freeze: true,
                    args: {
                        parent_doctype:      frm.doc.doctype,
                        trans_items,
                        parent_doctype_name: frm.doc.name,
                        child_docname,
                    },
                    callback: () => frm.reload_doc(),
                });

                this.hide();
            },

            primary_action_label: __("Update"),
        });

        dialog.show();

        setTimeout(() => {
            dialog.fields_dict.trans_items.grid.refresh();
        }, 300);
    }
}