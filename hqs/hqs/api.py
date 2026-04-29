import frappe


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def get_current_user_room():
    """Returns the QMS Room for the currently logged-in user via their counter."""
    user = frappe.session.user
    room = frappe.db.get_value("Queue Counter", {"assigned_user": user, "is_active": 1}, "room")
    return room


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def get_queue_dashboard():
    serving = frappe.get_all("Queue Entry",
        filters={"status": ["in", ["Called", "Serving"]]},
        fields=["token_number", "room", "counter", "priority"],
        order_by="called_at asc"
    )

    waiting = frappe.get_all("Queue Entry",
        filters={"status": "Waiting"},
        fields=["token_number", "room", "priority", "enqueued_at"],
        order_by="enqueued_at asc"
    )

    priority_order = {"Emergency": 0, "Urgent": 1, "Normal": 2}
    waiting = sorted(waiting, key=lambda x: priority_order.get(x.get("priority"), 3))

    # Safe display_order — falls back to counter_name if column not migrated yet
    try:
        counters = frappe.get_all("Queue Counter",
            filters={"is_active": 1},
            fields=["counter_name", "room", "display_order"],
            order_by="display_order asc"
        )
    except Exception:
        counters = frappe.get_all("Queue Counter",
            filters={"is_active": 1},
            fields=["counter_name", "room"],
            order_by="counter_name asc"
        )

    return {"serving": serving, "waiting": waiting, "counters": counters}


# ---------------------------------------------------------------------------
# SETTINGS
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def get_qms_settings():
    """Returns QMS Settings for use in kiosk, print, and display pages."""
    settings = frappe.get_single("QMS Setting")
    return {
        "token_prefix": settings.token_prefix or "T",
        "logo": settings.logo or None,
        "organization_name": settings.organization_name or "Hospital",
        "kiosk_title": settings.kiosk_title or "Queue Management System",
        "receipt_header": settings.receipt_header or "Hospital",
        "receipt_footer": settings.receipt_footer or "Thank You",
        "enable_printing": settings.enable_printing,
        "enable_sound": settings.enable_sound,
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


# ---------------------------------------------------------------------------
# PATIENT / CHECK-IN
# ---------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def check_patient(phone: str):
    existing = frappe.db.get_value("HQS Patient",
        {"mobile": phone},
        ["name", "patient_name"],
        as_dict=True
    )
    if existing:
        return {"exists": True, "name": existing.patient_name}
    return {"exists": False}


@frappe.whitelist(allow_guest=True)
def create_patient_visit(phone: str, full_name: str, reason_for_visit: str = ""):
    # Find or create HQS Patient
    patient = frappe.db.get_value("HQS Patient", {"mobile": phone}, "name")

    if not patient:
        parts = full_name.strip().split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""

        patient_doc = frappe.get_doc({
            "doctype": "HQS Patient",
            "first_name": first_name,
            "last_name": last_name,
            "patient_name": full_name,
            "mobile": phone,
            "name": phone,  # phone as unique key — prevents duplicates
        })
        patient_doc.insert(ignore_permissions=True)
        frappe.db.commit()
        patient = patient_doc.name

    # Assign to least busy counter in Reception
    # Patient sees only room name on ticket — counter assigned silently
    assignment = get_least_busy_counter("Reception")

    if not assignment:
        frappe.throw("No active reception counters configured. Please contact staff.")

    entry = frappe.get_doc({
        "doctype": "Queue Entry",
        "patient": patient,
        "room": assignment["room"],
        "counter": assignment["counter"],
        "priority": "Normal",
        "status": "Waiting",
    })
    entry.insert(ignore_permissions=True)
    frappe.db.commit()

    return {
        "token": entry.token_number,
        "room": assignment["room"],
        "counter": assignment["counter"],
        "queue_entry": entry.name
    }


def get_least_busy_counter(room_type="Reception"):
    """
    Finds the active counter inside the given room type with the
    fewest waiting/called/serving patients.
    Returns dict with room and counter name.
    """
    room = frappe.db.get_value("QMS Room",
        {"active": 1, "room_type": room_type}, "name"
    )
    if not room:
        return None

    counters = frappe.get_all("Queue Counter",
        filters={"room": room, "is_active": 1},
        fields=["name"]
    )
    if not counters:
        return None

    counter_loads = []
    for c in counters:
        count = frappe.db.count("Queue Entry", filters={
            "counter": c.name,
            "status": ["in", ["Waiting", "Called", "Serving"]]
        })
        counter_loads.append({"name": c.name, "load": count})

    least_busy = min(counter_loads, key=lambda x: x["load"])
    return {"room": room, "counter": least_busy["name"]}


def get_least_busy_room(room_type="Reception"):
    """Fallback — returns least busy room of a given type."""
    rooms = frappe.get_all("QMS Room",
        filters={"active": 1, "room_type": room_type},
        fields=["name"]
    )
    if not rooms:
        return None

    room_loads = []
    for r in rooms:
        count = frappe.db.count("Queue Entry", filters={
            "room": r.name,
            "status": ["in", ["Waiting", "Called", "Serving"]]
        })
        room_loads.append({"name": r.name, "load": count})

    least_busy = min(room_loads, key=lambda x: x["load"])
    return least_busy["name"]


# ---------------------------------------------------------------------------
# ROUTING
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_allowed_next_rooms(room: str):
    """
    Returns the list of rooms this room is allowed to forward patients to.
    Configured in the QMS Room Routing child table on each QMS Room record.
    Empty list means this is a dead-end room.
    """
    routing = frappe.get_all(
        "QMS Room Routing",
        filters={"parent": room, "parenttype": "QMS Room"},
        fields=["next_room"]
    )
    return routing


@frappe.whitelist()
def send_to_next_room(queue_entry: str, next_room: str, notes: str = ""):
    """
    Clerk manually selects which room to send the patient to next.
    If next_room is empty, patient is simply marked Done (dead end).
    """
    entry = frappe.get_doc("Queue Entry", queue_entry)

    if entry.status not in ["Called", "Serving"]:
        return {"success": False, "message": "Patient is not currently being served"}

    entry.status = "Done"
    entry.served_at = frappe.utils.now()
    if notes:
        entry.notes = notes
    entry.save(ignore_permissions=True)

    if next_room:
        new_entry = frappe.get_doc({
            "doctype": "Queue Entry",
            "patient": entry.patient,
            "room": next_room,
            "priority": entry.priority,
            "status": "Waiting",
            "token_number": entry.token_number,
            "current_step": (entry.current_step or 0) + 1,
        })
        new_entry.insert(ignore_permissions=True)

    frappe.db.commit()

    return {
        "success": True,
        "message": f"{entry.token_number} sent to {next_room}" if next_room else f"{entry.token_number} marked Done"
    }


# ---------------------------------------------------------------------------
# QUEUE — ROOM-BASED
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_my_room_queue():
    """Returns queue entries for the room assigned to the current user only."""
    user = frappe.session.user
    is_system_manager = "System Manager" in frappe.get_roles(user)

    filters = {"status": ["in", ["Waiting", "Called", "Serving"]]}

    if not is_system_manager:
        room = get_current_user_room()
        if not room:
            return {"error": "No room assigned to your account. Please contact the administrator."}
        filters["room"] = room

    return frappe.get_all("Queue Entry",
        filters=filters,
        fields=["name", "token_number", "room", "counter", "priority",
                "status", "patient", "enqueued_at", "called_at"],
        order_by="enqueued_at asc"
    )


@frappe.whitelist()
def get_my_counter():
    """Returns the counter record linked to the currently logged-in user."""
    user = frappe.session.user
    counter = frappe.db.get_value(
        "Queue Counter",
        {"assigned_user": user, "is_active": 1},
        ["name", "counter_name", "room"],
        as_dict=True
    )
    return counter or {}


@frappe.whitelist()
def peek_next_patient(room: str):
    """Returns who is next in the room queue without calling them."""
    priority_order = {"Emergency": 0, "Urgent": 1, "Normal": 2}

    waiting = frappe.get_all("Queue Entry",
        filters={"status": "Waiting", "room": room},
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
def call_next_patient(room: str, counter: str, queue_entry: str = None):
    """
    Calls the next patient in the room queue and assigns them to a counter.
    """
    if queue_entry:
        entry = frappe.get_doc("Queue Entry", queue_entry)
    else:
        priority_order = {"Emergency": 0, "Urgent": 1, "Normal": 2}
        waiting = frappe.get_all("Queue Entry",
            filters={"status": "Waiting", "room": room},
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
        "room": entry.room,
        "counter": counter,
        "message": f"Called {entry.token_number}"
    }


# ---------------------------------------------------------------------------
# STATS
# ---------------------------------------------------------------------------

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

    reception_room = frappe.db.get_value("QMS Room",
        {"room_type": "Reception", "active": 1}, "name"
    )

    return {
        "waiting": waiting,
        "served": served,
        "serving": serving,
        "avg_time": avg_time,
        "reception_room": reception_room or "Reception"
    }


@frappe.whitelist()
def get_triage_stats():
    today = frappe.utils.today()

    reception_room = frappe.db.get_value("QMS Room",
        {"room_type": "Reception", "active": 1}, "name") or "Reception"

    triage_room = frappe.db.get_value("QMS Room",
        {"room_type": "Triage", "active": 1}, "name") or "Triage"

    waiting_reception = frappe.db.count("Queue Entry", filters={
        "status": "Waiting",
        "room": reception_room,
        "creation": [">=", today]
    })

    waiting_triage = frappe.db.count("Queue Entry", filters={
        "status": "Waiting",
        "room": triage_room,
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


# ---------------------------------------------------------------------------
# DOCTORS
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_active_doctors():
    """Returns all doctors with Active or On Break status for today."""
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