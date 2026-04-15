import frappe


@frappe.whitelist(allow_guest=True)
def get_queue_dashboard():
    serving = frappe.get_all("Queue Entry",
        filters={"status": ["in", ["Called", "Serving"]]},
        fields=["token_number", "department", "counter", "priority"],
        order_by="called_at asc"
    )

    waiting = frappe.get_all("Queue Entry",
        filters={"status": "Waiting"},
        fields=["token_number", "department", "priority", "enqueued_at"],
        order_by="enqueued_at asc"
    )

    priority_order = {"Emergency": 0, "Urgent": 1, "Normal": 2}
    waiting = sorted(waiting, key=lambda x: priority_order.get(x.get("priority"), 3))

    counters = frappe.get_all("Queue Counter",
        filters={"is_active": 1},
        fields=["counter_name", "department"]
    )

    return {"serving": serving, "waiting": waiting, "counters": counters}


@frappe.whitelist(allow_guest=True)
def check_patient(phone: str):
    existing = frappe.db.get_value("Patient",
        {"mobile": phone},
        ["name", "patient_name"],
        as_dict=True
    )
    if existing:
        return {"exists": True, "name": existing.patient_name}
    return {"exists": False}


@frappe.whitelist(allow_guest=True)
def create_patient_visit(phone: str, full_name: str, reason_for_visit: str):
    visit = frappe.get_doc({
        "doctype": "Patient Visit",
        "phone_number": phone,
        "full_name": full_name,
        "reason_for_visit": reason_for_visit
    })
    visit.insert(ignore_permissions=True)
    frappe.db.commit()

    return {"token": visit.token_number, "visit": visit.name}


@frappe.whitelist()
def get_reception_stats():
    today = frappe.utils.today()

    waiting = frappe.db.count("Queue Entry", filters={
        "status": "Waiting",
        "creation": [">=", today]
    })

    served = frappe.db.count("Queue Entry", filters={
        "status": "Done",
        "creation": [">=", today]
    })

    serving = frappe.db.count("Queue Entry", filters={
        "status": ["in", ["Called", "Serving"]],
        "creation": [">=", today]
    })

    done_entries = frappe.get_all("Queue Entry",
        filters={"status": "Done", "creation": [">=", today]},
        fields=["enqueued_at", "served_at"]
    )

    avg_time = 0
    if done_entries:
        times = []
        for e in done_entries:
            if e.enqueued_at and e.served_at:
                diff = frappe.utils.time_diff_in_seconds(e.served_at, e.enqueued_at)
                times.append(diff / 60)
        if times:
            avg_time = round(sum(times) / len(times), 1)

    return {
        "waiting": waiting,
        "served": served,
        "serving": serving,
        "avg_time": avg_time
    }


@frappe.whitelist()
def call_next_patient(department: str, counter: str, queue_entry: str = None):
    if queue_entry:
        entry = frappe.get_doc("Queue Entry", queue_entry)
    else:
        priority_order = {"Emergency": 0, "Urgent": 1, "Normal": 2}
        waiting = frappe.get_all("Queue Entry",
            filters={"status": "Waiting", "department": department},
            fields=["name", "token_number", "priority", "patient"],
            order_by="enqueued_at asc"
        )
        if not waiting:
            return {"success": False, "message": "No patients waiting"}
        waiting = sorted(waiting, key=lambda x: priority_order.get(x.get("priority"), 3))
        entry = frappe.get_doc("Queue Entry", waiting[0].name)

    entry.status = "Called"
    entry.called_at = frappe.utils.now()
    entry.counter = counter
    entry.save(ignore_permissions=True)
    frappe.db.commit()

    return {
        "success": True,
        "token": entry.token_number,
        "patient": entry.patient,
        "department": entry.department,
        "message": f"Called {entry.token_number}"
    }


@frappe.whitelist()
def mark_done_and_next(queue_entry: str):
    entry = frappe.get_doc("Queue Entry", queue_entry)

    if entry.status not in ["Called", "Serving"]:
        return {"success": False, "message": "Patient is not being served"}

    entry.served_at = frappe.utils.now()
    entry.status = "Done"
    entry.save(ignore_permissions=True)
    frappe.db.commit()

    if entry.care_pathway:
        return {
            "success": True,
            "message": f"{entry.token_number} marked Done — moving to next department"
        }
    else:
        return {
            "success": True,
            "message": f"{entry.token_number} marked Done"
        }