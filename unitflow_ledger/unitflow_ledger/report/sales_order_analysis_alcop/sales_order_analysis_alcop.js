// Copyright (c) 2026, Finbyz Tech Pvt Ltd and contributors
// For license information, please see license.txt

let last_sales_order_for_color = null;
let sales_order_color_band = 0;

frappe.query_reports["Sales Order Analysis Alcop"] = {
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			width: "80",
			options: "Company",
			reqd: 1,
			default: frappe.defaults.get_default("company"),
		},
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
			width: "80",
			reqd: 1,
			default: frappe.datetime.add_months(frappe.datetime.get_today(), -1),
			on_change: (report) => {
				report.set_filter_value("sales_order", []);
				report.refresh();
			},
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
			width: "80",
			reqd: 1,
			default: frappe.datetime.get_today(),
			on_change: (report) => {
				report.set_filter_value("sales_order", []);
				report.refresh();
			},
		},
		{
			fieldname: "sales_order",
			label: __("Sales Order"),
			fieldtype: "MultiSelectList",
			width: "80",
			options: "Sales Order",
			get_data: function (txt) {
				let filters = { docstatus: 1 };

				const from_date = frappe.query_report.get_filter_value("from_date");
				const to_date = frappe.query_report.get_filter_value("to_date");
				if (from_date && to_date) filters["transaction_date"] = ["between", [from_date, to_date]];

				return frappe.db.get_link_options("Sales Order", txt, filters);
			},
		},
		{
			fieldname: "warehouse",
			label: __("Warehouse"),
			fieldtype: "Link",
			options: "Warehouse",
		},
		{
			fieldname: "status",
			label: __("Status"),
			fieldtype: "MultiSelectList",
			options: ["To Pay", "To Bill", "To Deliver", "To Deliver and Bill", "Completed", "Closed"],
			width: "80",
			get_data: function (txt) {
				let status = [
					"To Pay",
					"To Bill",
					"To Deliver",
					"To Deliver and Bill",
					"Completed",
					"Closed",
				];
				let options = [];
				for (let option of status) {
					options.push({
						value: option,
						label: __(option),
						description: "",
					});
				}
				return options;
			},
		},

		{
            fieldname: "customer",
            label: "Customer",
            fieldtype: "MultiSelectList",
            options: "Customer",
            get_data: function(txt) {
                return frappe.db.get_link_options("Customer", txt);
            }
        },
		{
			fieldname: "show_detailed_view",
			label: __("Show Detailed View"),
			fieldtype: "Check",
			default: 1,
		},
		{
			fieldname: "group_by_so",
			label: __("Group by Sales Order"),
			fieldtype: "Check",
			default: 0,
		},
		{
            fieldname: "filter_by_delay",
            label: "Filter by Delay",
            fieldtype: "Check",
        },
        {
            fieldname: "delay_days",
            label: "Delay (Days)",
            fieldtype: "Int",
            depends_on: "eval:doc.filter_by_delay == 1"
        }
	],

	tree: false,  // Will be enabled dynamically
	initial_depth: 1,
	
	onload: function(report) {
		// Monitor the show_detailed_view filter
		report.page.on('show', function() {
			const show_detailed = frappe.query_report.get_filter_value('show_detailed_view');
			frappe.query_reports["Sales Order Analysis Alcop"].tree = show_detailed ? true : false;
		});
	},

	after_refresh: function() {
		last_sales_order_for_color = null;
		sales_order_color_band = 0;
	},

	formatter: function (value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);
		let format_fields = ["delivered_qty", "billed_amount"];

		if (in_list(format_fields, column.fieldname) && data && data[column.fieldname] > 0) {
			value = "<span style='color:green;'>" + value + "</span>";
		}

		if (column.fieldname == "delay" && data && data[column.fieldname] > 0) {
			value = "<span style='color:red;'>" + value + "</span>";
		}

		if (data) {
			if (data.__sales_order_color_band === undefined) {
				const current_sales_order = data.sales_order || "";
				if (current_sales_order !== last_sales_order_for_color) {
					if (last_sales_order_for_color !== null) {
						sales_order_color_band = sales_order_color_band ? 0 : 1;
					}
					last_sales_order_for_color = current_sales_order;
				}
				data.__sales_order_color_band = sales_order_color_band;
			}

			const bg_color = data.__sales_order_color_band ? "#aae3ec" : "#fffaf0";
			value = `<span style="display:block;background-color:${bg_color};margin:-8px -10px;padding:8px 10px;">${value}</span>`;
		}
		return value;
	},
};
