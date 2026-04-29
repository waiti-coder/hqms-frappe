import frappe

def fix_user_default_app(doc, method):
    """Prevent blank default_app from breaking login."""
    if doc.default_app == "" or doc.default_app == " ":
        frappe.db.set_value("User", doc.name, "default_app", None)
        frappe.db.commit()