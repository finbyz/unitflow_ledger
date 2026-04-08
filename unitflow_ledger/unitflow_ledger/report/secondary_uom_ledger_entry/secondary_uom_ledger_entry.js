// Copyright (c) 2026, Finbyz Tech Pvt Ltd and contributors
// For license information, please see license.txt

frappe.query_reports["Secondary UOM Ledger Entry"] = {
	filters: [
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
			default: frappe.datetime.add_months(frappe.datetime.get_today(), -1),
			reqd: 1,
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
			default: frappe.datetime.get_today(),
			reqd: 1,
		},
		{
			fieldname: "item_code",
			label: __("Item Code"),
			fieldtype: "Link",
			options: "Item",
			reqd: 0,
		},
		{
			fieldname: "warehouse",
			label: __("Warehouse"),
			fieldtype: "Link",
			options: "Warehouse",
			reqd: 0,
		},
		{
			fieldname: "voucher_type",
			label: __("Voucher Type"),
			fieldtype: "Select",
			options: "\nStock Entry\nDelivery Note\nPurchase Receipt\nSales Invoice\nPurchase Invoice",
			reqd: 0,
		},
		{
			fieldname: "voucher_no",
			label: __("Voucher No"),
			fieldtype: "Data",
			reqd: 0,
		},
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			default: frappe.defaults.get_user_default("company"),
			reqd: 1,
		},
		{
			fieldname: "show_cancelled_entries",
			label: __("Show Cancelled Entries"),
			fieldtype: "Check",
			default: 0,
			reqd: 0,
		},
	],

	formatter: function (value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);

		if (data && data.is_total_row) {
			value = `<b style="color:#2c3e50">${value}</b>`;
		}

		if (data && data.actual_qty && data.actual_qty < 0) {
			if (column.fieldname === "actual_qty") {
				value = `<span style="color: #c0392b; font-weight: 600;">${value}</span>`;
			}
		}

		if (data && data.actual_qty && data.actual_qty > 0) {
			if (column.fieldname === "actual_qty") {
				value = `<span style="color: #27ae60; font-weight: 600;">${value}</span>`;
			}
		}

		return value;
	},

	onload: function (report) {
		report.page.add_inner_button(__("Clear Filters"), function () {
			report.filters.forEach(function (filter) {
				filter.set_value(null);
			});
			report.filters.forEach(function (filter) {
				if (filter.df.fieldname === "from_date") {
					filter.set_value(frappe.datetime.add_months(frappe.datetime.get_today(), -1));
				}
				if (filter.df.fieldname === "to_date") {
					filter.set_value(frappe.datetime.get_today());
				}
				if (filter.df.fieldname === "company") {
					filter.set_value(frappe.defaults.get_user_default("company"));
				}
			});
		});
	},
};