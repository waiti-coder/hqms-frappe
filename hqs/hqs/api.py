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
def peek_next_patient(department: str):
    """Returns who is next in queue without calling them — used to preview before confirming."""
    priority_order = {"Emergency": 0, "Urgent": 1, "Normal": 2}

    waiting = frappe.get_all("Queue Entry",
        filters={"status": "Waiting", "department": department},
        fields=["name", "token_number", "priority", "patient", "enqueued_at"],
        order_by="enqueued_at asc"
    )

    if not waiting:
        return {"success": False, "message": "No patients waiting"}

    waiting = sorted(waiting, key=lambda x: priority_order.get(x.get("priority"), 3))
    next_patient = waiting[0]

    waiting_since = ""
    if next_patient.get("enqueued_at"):
        diff_mins = int(frappe.utils.time_diff_in_seconds(
            frappe.utils.now(), next_patient["enqueued_at"]
        ) / 60)
        if diff_mins < 1:
            waiting_since = "just now"
        elif diff_mins == 1:
            waiting_since = "1 minute"
        else:
            waiting_since = f"{diff_mins} minutes"

    return {
        "success": True,
        "name": next_patient["name"],
        "token_number": next_patient["token_number"],
        "patient": next_patient.get("patient") or "—",
        "priority": next_patient.get("priority") or "Normal",
        "waiting_since": waiting_since
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
        "queue_entry": entry.name,
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

    # ✅ Create new Queue Entry in the next department
    if entry.next_department:
        new_entry = frappe.get_doc({
            "doctype": "Queue Entry",
            "patient": entry.patient,
            "patient_name": entry.patient_name,
            "department": entry.next_department,
            "priority": entry.priority,
            "status": "Waiting",
            "enqueued_at": frappe.utils.now(),
            "current_step": (entry.current_step or 1) + 1
        })
        new_entry.insert(ignore_permissions=True)

    frappe.db.commit()

    return {
        "success": True,
        "message": f"{entry.token_number} marked Done — moving to {entry.next_department or entry.care_pathway or 'next department'}"
    }


@frappe.whitelist(allow_guest=True)
def get_company_details():
    company = frappe.db.get_single_value("Global Defaults", "default_company")
    if not company:
        companies = frappe.get_all("Company", limit=1)
        company = companies[0].name if companies else None

    if not company:
        return {"logo": None, "color": "#2B5BA8", "name": "Hospital"}

    details = frappe.db.get_value("Company", company,
        ["company_logo", "name"],
        as_dict=True
    )

    return {
        "logo": details.company_logo if details else None,
        "name": details.name if details else company,
        "color": "#2B5BA8"
    }


@frappe.whitelist()
def get_active_doctors():
    """Returns all doctors with Active or On Break status for today,
    including the counter linked to their consultation room."""
    today = frappe.utils.today()

    assignments = frappe.get_all("Doctor Room Assignment",
        filters={
            "date": today,
            "status": ["in", ["Active", "On Break"]]
        },
        fields=["name", "doctor", "consultation_room", "status"]
    )

    result = []
    for a in assignments:
        doctor_name = frappe.db.get_value(
            "Healthcare Practitioner", a.doctor, "practitioner_name"
        ) or a.doctor

        counter = frappe.db.get_value(
            "Queue Counter",
            {"consultation_room": a.consultation_room, "is_active": 1},
            "counter_name"
        ) or None

        result.append({
            "name": a.name,
            "doctor": a.doctor,
            "doctor_name": doctor_name,
            "room": a.consultation_room,
            "counter": counter,
            "status": a.status
        })

    return result


@frappe.whitelist()
def update_doctor_status(assignment: str, status: str):
    """Allows a doctor to update their own assignment status."""
    valid_statuses = ["Active", "On Break", "Done"]
    if status not in valid_statuses:
        return {"success": False, "message": "Invalid status"}

    entry = frappe.get_doc("Doctor Room Assignment", assignment)

    current_user = frappe.session.user
    is_system_manager = "System Manager" in frappe.get_roles(current_user)

    practitioner = frappe.db.get_value(
        "Healthcare Practitioner", {"user": current_user}, "name"
    )

    if not is_system_manager and practitioner != entry.doctor:
        return {"success": False, "message": "You can only update your own assignment"}

    entry.status = status
    entry.save(ignore_permissions=True)
    frappe.db.commit()

    return {"success": True, "message": f"Status updated to {status}"}


@frappe.whitelist()
def get_triage_stats():
    """Returns queue stats for the triage workspace dashboard."""
    today = frappe.utils.today()

    waiting_reception = frappe.db.count("Queue Entry", filters={
        "status": "Waiting",
        "department": "Reception",
        "creation": [">=", today]
    })

    waiting_triage = frappe.db.count("Queue Entry", filters={
        "status": "Waiting",
        "department": "Triage",
        "creation": [">=", today]
    })

    served = frappe.db.count("Queue Entry", filters={
        "status": "Done",
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
        "waiting_reception": waiting_reception,
        "waiting_triage": waiting_triage,
        "served": served,
        "avg_time": avg_time
    }