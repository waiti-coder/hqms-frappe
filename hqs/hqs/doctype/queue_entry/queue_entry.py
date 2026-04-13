import frappe
from frappe.model.document import Document

class QueueEntry(Document):
    # begin: auto-generated types
    # This code is auto-generated. Do not modify anything in this block.

    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from frappe.types import DF

        appoinment: DF.Link | None
        called_at: DF.Datetime | None
        care_pathway: DF.Link | None
        counter: DF.Link | None
        current_step: DF.Int
        department: DF.Link
        enqueued_at: DF.Datetime | None
        name: DF.Int | None
        next_department: DF.Link | None
        notes: DF.SmallText | None
        patient: DF.Link
        patient_name: DF.Data | None
        priority: DF.Literal["Normal", "Urgent", "Emergency"]
        served_at: DF.Datetime | None
        status: DF.Literal["Waiting", "Called", "Serving", "Done", "No"]
        token_number: DF.Data | None
    # end: auto-generated types

    def before_insert(self):
        self.enqueued_at = frappe.utils.now()
        self.token_number = self.generate_token()

    def generate_token(self):
        dept = frappe.db.get_value("Medical Department", self.department, "department") or self.department
        prefix = dept[:3].upper()

        today = frappe.utils.today()
        count = frappe.db.count("Queue Entry", filters={
            "department": self.department,
            "creation": [">=", today]
        })

        return f"{prefix}-{str(count + 1).zfill(3)}"

    def on_update(self):
        if self.status == "Done":
            self.enqueue_next_department()

    def enqueue_next_department(self):
        if not self.care_pathway:
            return

        steps = frappe.get_all("Care Path Steps",
            filters={"parent": self.care_pathway},
            fields=["department", "order"],
            order_by="order asc"
        )

        if not steps:
            return

        current_step = self.current_step or 0
        next_steps = [s for s in steps if s.order > current_step]

        if not next_steps:
            frappe.msgprint(f"Patient {self.patient} has completed all steps in the pathway.")
            return

        next_step = next_steps[0]

        new_entry = frappe.get_doc({
            "doctype": "Queue Entry",
            "patient": self.patient,
            "department": next_step.department,
            "priority": self.priority,
            "care_pathway": self.care_pathway,
            "current_step": next_step.order,
            "status": "Waiting"
        })
        new_entry.insert()
        frappe.db.commit()

        frappe.msgprint(f"Patient enqueued to {next_step.department}")