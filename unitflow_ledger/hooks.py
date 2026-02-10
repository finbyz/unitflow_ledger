app_name = "unitflow_ledger"
app_title = "UnitFlow Ledger"
app_publisher = "Finbyz Tech Pvt Ltd"
app_description = "Secondary Uom with Stock ledger"
app_email = "info@finbyz.com"
app_license = "mit"

# Apps
# ------------------
fixtures = [
    {
        "dt": "Custom Field",
        "filters": {"module": ["in", ["UnitFlow Ledger"]]},
    }
]
# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "unitflow_ledger",
# 		"logo": "/assets/unitflow_ledger/logo.png",
# 		"title": "UnitFlow Ledger",
# 		"route": "/unitflow_ledger",
# 		"has_permission": "unitflow_ledger.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/unitflow_ledger/css/unitflow_ledger.css"
# app_include_js = "/assets/unitflow_ledger/js/unitflow_ledger.js"

# include js, css files in header of web template
# web_include_css = "/assets/unitflow_ledger/css/unitflow_ledger.css"
# web_include_js = "/assets/unitflow_ledger/js/unitflow_ledger.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "unitflow_ledger/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {
    "Item": "public/js/item.js",
    "Sales Order": "public/js/sales_order.js",
    "Purchase Receipt": "public/js/purchase_reciept.js",
    "Delivery Note": "public/js/delivery_note.js",
    "Sales Invoice": "public/js/sales_invoice.js",
    "Purchase Invoice": "public/js/purchase_invoice.js",
    "Stock Entry": "public/js/stock_entry.js",
}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "unitflow_ledger/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "unitflow_ledger.utils.jinja_methods",
# 	"filters": "unitflow_ledger.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "unitflow_ledger.install.before_install"
# after_install = "unitflow_ledger.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "unitflow_ledger.uninstall.before_uninstall"
# after_uninstall = "unitflow_ledger.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "unitflow_ledger.utils.before_app_install"
# after_app_install = "unitflow_ledger.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "unitflow_ledger.utils.before_app_uninstall"
# after_app_uninstall = "unitflow_ledger.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "unitflow_ledger.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }
doc_events = {
	# "Stock Ledger Entry": {
	# 	"after_insert": "unitflow_ledger.doc_events.stock_ledger_entry.create_secondary_uom_ledger_entry"
	# },
	 "Sales Invoice": {
        "before_cancel": "unitflow_ledger.doc_events.cancel_su_sle.before_cancel",
        "on_submit": "unitflow_ledger.doc_events.Sales_invoice.create_secondary_sle",
    },
    "Purchase Invoice": {
        "before_cancel": "unitflow_ledger.doc_events.cancel_su_sle.before_cancel",
        "on_submit": "unitflow_ledger.doc_events.purchase_invoice.create_secondary_sle",
    },
    "Delivery Note": {
        "before_cancel": "unitflow_ledger.doc_events.cancel_su_sle.before_cancel",
        "on_submit": "unitflow_ledger.doc_events.delivery_note.create_secondary_sle",
    },
    "Purchase Receipt": {
        "before_cancel": "unitflow_ledger.doc_events.cancel_su_sle.before_cancel",
        "on_submit": "unitflow_ledger.doc_events.purchase_reciept.create_secondary_sle",
    },
    "Stock Entry": {
        "before_cancel": "unitflow_ledger.doc_events.cancel_su_sle.before_cancel",
        "on_submit": "unitflow_ledger.doc_events.stock_entry.create_secondary_sle",
    },
}


# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"unitflow_ledger.tasks.all"
# 	],
# 	"daily": [
# 		"unitflow_ledger.tasks.daily"
# 	],
# 	"hourly": [
# 		"unitflow_ledger.tasks.hourly"
# 	],
# 	"weekly": [
# 		"unitflow_ledger.tasks.weekly"
# 	],
# 	"monthly": [
# 		"unitflow_ledger.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "unitflow_ledger.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "unitflow_ledger.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "unitflow_ledger.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "unitflow_ledger.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["unitflow_ledger.utils.before_request"]
# after_request = ["unitflow_ledger.utils.after_request"]

# Job Events
# ----------
# before_job = ["unitflow_ledger.utils.before_job"]
# after_job = ["unitflow_ledger.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"unitflow_ledger.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []

