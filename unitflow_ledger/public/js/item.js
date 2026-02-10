frappe.ui.form.on('Item', {
    uoms: function(frm) {
        calculate_uom_conversion(frm);
    }
});

frappe.ui.form.on('UOM Conversion Detail', {
    conversion_factor: function(frm, cdt, cdn) {
        calculate_uom_conversion(frm);
    },
    uom: function(frm, cdt, cdn) {
        calculate_uom_conversion(frm);
    },
    uoms_add: function(frm, cdt, cdn) {
        calculate_uom_conversion(frm);
    },
    uoms_remove: function(frm, cdt, cdn) {
        calculate_uom_conversion(frm);
    }
});

function calculate_uom_conversion(frm) {
    console.log("Calculating UOM conversions");
    if (!frm.doc.uoms || frm.doc.uoms.length === 0) return;

     frm.doc.uoms.forEach(row => {
        if (!row.conversion_factor || row.conversion_factor <= 0) {
            row.conversion_factor = 1;
        }
    });
    frm.refresh_field('uoms');
}
