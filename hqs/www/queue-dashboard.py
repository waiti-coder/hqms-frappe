import frappe

@frappe.whitelist(allow_guest=True)
def get_queue_dashboard():
    serving = frappe.get_all("Queue Entry",
        filters={"status": "Serving"},
        fields=["token_number", "department", "counter", "priority"],
        order_by="called_at asc"
    )

    # Get waiting sorted by enqueued_at, we'll sort priority in Python
    waiting = frappe.get_all("Queue Entry",
        filters={"status": "Waiting"},
        fields=["token_number", "department", "priority", "enqueued_at"],
        order_by="enqueued_at asc"
    )

    # Sort by priority in Python
    priority_order = {"Emergency": 0, "Urgent": 1, "Normal": 2}
    waiting = sorted(waiting, key=lambda x: priority_order.get(x.get("priority"), 3))

    return {"serving": serving, "waiting": waiting}