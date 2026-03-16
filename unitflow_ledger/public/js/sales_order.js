let updating = false;

frappe.ui.form.on("Sales Order", {
    refresh(frm) {
        patch_update_child_items_for_so(frm);
    },
});


frappe.ui.form.on("Sales Order Item", {

    item_code(frm, cdt, cdn) {
        set_secondary_fields(frm, cdt, cdn);
    },

    qty(frm, cdt, cdn) {
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

            let sec = item.uoms.find(u => u.uom !== item.stock_uom);
            if (!sec) return;

            updating = true;

            frappe.model.set_value(cdt, cdn, "secondary_uom", sec.uom);
            frappe.model.set_value(cdt, cdn, "secondary_conversion_factor", sec.conversion_factor);

            let qty = (row.qty === null || row.qty === undefined || row.qty === 0) ? 1 : row.qty;
            frappe.model.set_value(cdt, cdn, "secondary_qty", qty / sec.conversion_factor);

            updating = false;
        }
    });
}

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
        row.qty / factor
    );

    updating = false;
}

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
        row.secondary_qty * factor
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

/**
 * Patch erpnext.utils.update_child_items for Sales Order to include
 * UOM, Secondary UOM, Secondary Qty, and Secondary Conversion Factor
 * in the "Update Items" dialog.
 */
function patch_update_child_items_for_so(frm) {
    if (frm.doc.doctype !== "Sales Order") return;
    if (erpnext.utils._secondary_patched) return;
    erpnext.utils._secondary_patched = true;

    const _original = erpnext.utils.update_child_items.bind(erpnext.utils);

    erpnext.utils.update_child_items = function (opts) {
        const frm = opts.frm;
        if (frm.doc.doctype !== "Sales Order") {
            return _original(opts);
        }

        const cannot_add_row = typeof opts.cannot_add_row === "undefined" ? true : opts.cannot_add_row;
        const child_docname = opts.child_docname || "items";
        const child_meta = frappe.get_meta("Sales Order Item");
        const has_reserved_stock = opts.has_reserved_stock ? true : false;
        const get_precision = (fieldname) => {
            const f = child_meta.fields.find((f) => f.fieldname === fieldname);
            return f ? f.precision : 2;
        };

        // Build row data including secondary fields
        const data = frm.doc[child_docname].map((d) => ({
            docname: d.name,
            name: d.name,
            item_code: d.item_code,
            item_name: d.item_name,
            delivery_date: d.delivery_date,
            conversion_factor: d.conversion_factor,
            qty: d.qty,
            price_list_rate: d.price_list_rate,        // ← changed from rate
            discount_percentage: d.discount_percentage,
            uom: d.uom,
            secondary_uom: d.secondary_uom || "",
            secondary_qty: d.secondary_qty || 0,
            secondary_conversion_factor: d.secondary_conversion_factor || 0,
            description: d.description,
        }));

        const fields = [
            { fieldtype: "Data", fieldname: "docname", read_only: 1, hidden: 1 },
            {
                fieldtype: "Link",
                fieldname: "item_code",
                options: "Item",
                in_list_view: 1,
                read_only: 0,
                label: __("Item Code"),
                get_query: function () {
                    return {
                        query: "erpnext.controllers.queries.item_query",
                        filters: { is_sales_item: 1, is_stock_item: !frm.doc.is_subcontracted },
                    };
                },
                onchange: function () {
                    const me = this;
                    if (!this.value) return;

                    // Replicate standard item detail fetching
                    frm.call({
                        method: "erpnext.stock.get_item_details.get_item_details",
                        args: {
                            doc: frm.doc,
                            ctx: {
                                item_code: this.value,
                                company: frm.doc.company,
                                customer: frm.doc.customer || frm.doc.party_name,
                                currency: frm.doc.currency,
                                price_list: frm.doc.selling_price_list,
                                is_pos: cint(frm.doc.is_pos),
                                is_return: cint(frm.doc.is_return),
                                doctype: frm.doc.doctype,
                                name: frm.doc.name,
                                qty: me.doc.qty || 1,
                                child_doctype: "Sales Order Item",
                            },
                        },
                        callback: function (r) {
                            if (r.message) {
                                const d = r.message;
                                const row = dialog.fields_dict.trans_items.df.data.find(
                                    (row) => row.name == me.doc.name
                                );
                                if (row) {
                                    Object.assign(row, {
                                        item_name: d.item_name,
                                        uom: d.uom,
                                        conversion_factor: d.conversion_factor,
                                        qty: me.doc.qty || 1,
                                        price_list_rate: d.price_list_rate || 0,        // ← was rate
                                        discount_percentage: d.discount_percentage || 0,
                                        description: d.description,
                                    });

                                    // Fetch secondary UOM for the new item
                                    frappe.db.get_doc("Item", me.value).then((item_doc) => {
                                        const sec = (item_doc.uoms || []).find((u) => u.uom !== d.uom);
                                        if (sec) {
                                            row.secondary_uom = sec.uom;
                                            row.secondary_conversion_factor = flt(sec.conversion_factor);
                                            row.secondary_qty = flt(row.qty) / (flt(sec.conversion_factor) || 1);
                                        }
                                        dialog.fields_dict.trans_items.grid.refresh();
                                    });
                                }
                            }
                        },
                    });
                },
            },
            {
                fieldtype: "Data",
                fieldname: "item_name",
                label: __("Item Name"),
                read_only: 1,
            },
            {
                fieldtype: "Date",
                fieldname: "delivery_date",
                in_list_view: 1,
                label: __("Delivery Date"),
                default: frm.doc.delivery_date,
                reqd: 1,
            },
            {
                fieldtype: "Float",
                fieldname: "conversion_factor",
                label: __("Conversion Factor"),
                precision: get_precision("conversion_factor"),
            },
            {
                fieldtype: "Link",
                fieldname: "uom",
                options: "UOM",
                in_list_view: 1,
                read_only: 0,
                label: __("UOM"),
                reqd: 1,
                onchange: function () {
                    const me = this;
                    const item_code = me.doc.item_code;
                    const primary_uom = me.value;
                    if (!item_code || !primary_uom) return;

                    // Update primary conversion factor
                    frappe.call({
                        method: "erpnext.stock.get_item_details.get_conversion_factor",
                        args: { item_code: item_code, uom: primary_uom },
                        callback: (r) => {
                            if (!r.exc && r.message) {
                                const row = dialog.fields_dict.trans_items.df.data.find(
                                    (r) => r.name === me.doc.name
                                );
                                if (row) {
                                    row.conversion_factor = r.message.conversion_factor;

                                    // Recalculate secondary if primary UOM changes
                                    frappe.db.get_doc("Item", item_code).then((item_doc) => {
                                        const sec = (item_doc.uoms || []).find((u) => u.uom !== primary_uom);
                                        if (sec) {
                                            row.secondary_uom = sec.uom;
                                            row.secondary_conversion_factor = flt(sec.conversion_factor);
                                            row.secondary_qty = flt(row.qty) / (flt(sec.conversion_factor) || 1);
                                        }
                                        dialog.fields_dict.trans_items.grid.refresh();
                                    });
                                }
                            }
                        },
                    });
                },
            },
            {
                fieldtype: "Float",
                fieldname: "qty",
                default: 0,
                read_only: 0,
                in_list_view: 1,
                label: __("Qty"),
                precision: get_precision("qty"),
                onchange: function () {
                    const me = this;
                    const row = dialog.fields_dict.trans_items.df.data.find(
                        (r) => r.name === me.doc.name
                    );
                    if (row && flt(row.secondary_conversion_factor)) {
                        row.secondary_qty = flt(me.value) / flt(row.secondary_conversion_factor);
                        dialog.fields_dict.trans_items.grid.refresh();
                    }
                },
            },
            {
                fieldtype: "Currency",
                fieldname: "price_list_rate",
                options: "currency",
                in_list_view: 1,
                label: __("Price List Rate"),
                precision: get_precision("price_list_rate"),
                onchange: function () {

                    const me = this;

                    const row = dialog.fields_dict.trans_items.df.data.find(
                        (r) => r.name === me.doc.name
                    );

                    if (!row) return;

                    let discount = flt(row.discount_percentage || 0);

                    row.rate = flt(me.value) * (1 - discount / 100);

                    dialog.fields_dict.trans_items.grid.refresh();
                }
            },
            {
                fieldtype: "Percent",
                fieldname: "discount_percentage",
                in_list_view: 1,
                label: __("Discount %"),
                precision: get_precision("discount_percentage"),
                onchange: function () {

                    const me = this;

                    const row = dialog.fields_dict.trans_items.df.data.find(
                        (r) => r.name === me.doc.name
                    );

                    if (!row) return;

                    let rate = flt(row.price_list_rate || 0);
                    let discount = flt(me.value || 0);

                    row.rate = rate * (1 - discount / 100);

                    dialog.fields_dict.trans_items.grid.refresh();
                }
            },
            {
                fieldtype: "Link",
                fieldname: "secondary_uom",
                options: "UOM",
                in_list_view: 1,
                read_only: 0,
                label: __("Sec UOM"),
                onchange: function () {
                    const me = this;
                    const item_code = me.doc.item_code;
                    const new_sec_uom = me.value;
                    if (!item_code || !new_sec_uom) return;

                    frappe.db.get_doc("Item", item_code).then((item_doc) => {
                        const sec = (item_doc.uoms || []).find((u) => u.uom === new_sec_uom);
                        const row = dialog.fields_dict.trans_items.df.data.find(
                            (r) => r.name === me.doc.name
                        );
                        if (row) {
                            row.secondary_conversion_factor = sec ? flt(sec.conversion_factor) : 0;
                            row.secondary_qty =
                                sec && flt(sec.conversion_factor)
                                    ? flt(row.qty) / flt(sec.conversion_factor)
                                    : 0;
                            dialog.fields_dict.trans_items.grid.refresh();
                        }
                    });
                },
            },
            {
                fieldtype: "Float",
                fieldname: "secondary_qty",
                default: 0,
                read_only: 0,
                in_list_view: 1,
                label: __("Sec Qty"),
                precision: get_precision("secondary_qty"),
                onchange: function () {
                const me = this;
                const row = dialog.fields_dict.trans_items.df.data.find(
                    (r) => r.name === me.doc.name
                );
                if (row && flt(row.secondary_conversion_factor)) {
                    row.qty = flt(me.value) * flt(row.secondary_conversion_factor);
                    dialog.fields_dict.trans_items.grid.refresh();
                    }
                },
            },
            {
                fieldtype: "Float",
                fieldname: "secondary_conversion_factor",
                default: 0,
                read_only: 1,
                in_list_view: 1,
                label: __("Sec Conv Factor"),
                precision: get_precision("secondary_conversion_factor"),
            },
            {
                fieldtype: "Text Editor",
                fieldname: "description",
                read_only: 0,
                label: __("Description"),
            },
        ];

        let dialog = new frappe.ui.Dialog({
            title: __("Update Items"),
            size: "extra-large",
            fields: [
                {
                    fieldname: "trans_items",
                    fieldtype: "Table",
                    label: "Items",
                    cannot_add_rows: cannot_add_row,
                    in_place_edit: false,
                    reqd: 1,
                    data: data,
                    get_data: () => data,
                    fields: fields,
                },
            ],
            primary_action: function () {
                if (frm.doc.doctype == "Sales Order" && has_reserved_stock && frm.doc.is_subcontracted == 0) {
                    this.hide();
                    frappe.confirm(
                        __(
                            "The reserved stock will be released when you update items. Are you certain you wish to proceed?"
                        ),
                        () => this.update_items()
                    );
                } else {
                    this.update_items();
                }
            },
            // update_items: function () {
            //     const trans_items = this.get_values()["trans_items"]
            //         .filter(item => !!item.item_code);
            //         trans_items.forEach(row => {

            //         // ERPNext pricing fields
            //         row.rate = flt(row.price_list_rate || 0);
            //         row.price_list_rate = flt(row.price_list_rate || 0);
            //         row.discount_percentage = flt(row.discount_percentage || 0);

            //         // ensure qty precision
            //         row.qty = flt(row.qty || 0);
            //         row.conversion_factor = flt(row.conversion_factor || 1);

            //         // secondary fields
            //         row.secondary_qty = flt(row.secondary_qty || 0);
            //         row.secondary_conversion_factor = flt(row.secondary_conversion_factor || 0);

            //     });
            //     // trans_items.forEach(row => {
            //     //     row.rate = flt(row.price_list_rate || 0);
                    
            //     // });

            //     frappe.call({
            //         method: "erpnext.controllers.accounts_controller.update_child_qty_rate",
            //         freeze: true,
            //         args: {
            //             parent_doctype: frm.doc.doctype,
            //             trans_items: trans_items,
            //             parent_doctype_name: frm.doc.name,
            //             child_docname: child_docname,
            //         },
            //         callback: function () {
            //             frm.reload_doc();
            //         },
            //     });
            //     this.hide();
            // },
            update_items: function () {

            const trans_items = this.get_values()["trans_items"]
                .filter(item => !!item.item_code);

            trans_items.forEach(row => {

                let price = flt(row.price_list_rate || 0);
                let discount = flt(row.discount_percentage || 0);

                row.rate = price * (1 - discount / 100);

                row.qty = flt(row.qty || 0);
                row.conversion_factor = flt(row.conversion_factor || 1);

                row.secondary_qty = flt(row.secondary_qty || 0);
                row.secondary_conversion_factor = flt(row.secondary_conversion_factor || 0);

            });

            frappe.call({
                method: "erpnext.controllers.accounts_controller.update_child_qty_rate",
                freeze: true,
                args: {
                    parent_doctype: frm.doc.doctype,
                    trans_items: trans_items,
                    parent_doctype_name: frm.doc.name,
                    child_docname: child_docname,
                },
                callback: function () {
                    frm.reload_doc();
                },
            });

            this.hide();
        },
            primary_action_label: __("Update"),
        });

        dialog.show();
    };
}