// Copyright (c) 2026, Finbyz Tech Pvt Ltd and contributors
// For license information, please see license.txt

frappe.query_reports["Sales Dispatch Item"] = {
	filters: [
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
			default: frappe.datetime.add_months(frappe.datetime.get_today(), -1),
			reqd: 0,
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
			default: frappe.datetime.get_today(),
			reqd: 0,
		},
		{
			fieldname: "sales_order",
			label: __("Sales Order"),
			fieldtype: "Link",
			options: "Sales Order",
			reqd: 0,
		},
		{
			fieldname: "item_code",
			label: __("Item"),
			fieldtype: "Link",
			options: "Item",
			reqd: 0,
		},
		{
			fieldname: "customer",
			label: __("Customer / Party"),
			fieldtype: "Link",
			options: "Customer",
			reqd: 0,
		},
		{
			fieldname: "detailed_view",
			label: __("Detailed View"),
			fieldtype: "Check",
			default: 0,
			reqd: 0,
		},
	],

	formatter: function (value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);

		if (data && data.is_group) {
			value = `<b style="color:#2c3e50">${value}</b>`;
		}

		if (data && data.is_subtotal) {
			value = `<b style="color: #1a1a2e;">${value}</b>`;
		}

		if (
			data &&
			!data.is_subtotal &&
			(column.fieldname === "pending_stock_qty" || column.fieldname === "pending_secondary_qty")
		) {
			const raw = data[column.fieldname];
			if (raw && raw > 0) {
				value = `<span style="color: #c0392b; font-weight: 600;">${value}</span>`;
			} else if (raw === 0) {
				value = `<span style="color: #27ae60; font-weight: 600;">${value}</span>`;
			}
		}

		return value;
	},

	get_datatable_options(options) {
		return Object.assign(options, {
			checkboxColumn: true,
			treeView: true,     // ⭐ REQUIRED for collapse
			initialDepth: 1     // ⭐ collapsed by default
		});
	},

	onload: function (report) {
		report.page.add_inner_button(__("Clear Filters"), function () {
			report.filters.forEach(function (filter) {
				filter.set_value(null);
			});
		});
	},
};