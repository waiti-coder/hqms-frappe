import frappe
from frappe.model.document import Document


class PatientVisit(Document):

    def before_insert(self):
        self.visit_date = frappe.utils.today()
        self.status = "Waiting"
        self.check_existing_patient()
        self.create_queue_entry()

    def check_existing_patient(self):
        existing = frappe.db.get_value("Patient",
            {"mobile": self.phone_number},
            ["name", "patient_name"],
            as_dict=True
        )
        if existing:
            self.patient = existing.name
            self.full_name = existing.patient_name
            self.is_new_patient = 0
        else:
            self.is_new_patient = 1
            new_patient = frappe.get_doc({
                "doctype": "Patient",
                "first_name": self.full_name,
                "mobile": self.phone_number,
                "sex": "Other"
            })
            new_patient.insert(ignore_permissions=True)
            self.patient = new_patient.name

    def create_queue_entry(self):
        # Get Reception department
        reception = frappe.db.get_value("Medical Department",
            {"department": ["like", "%Reception%"]}, "name"
        )

        if not reception:
            depts = frappe.get_all("Medical Department", limit=1)
            reception = depts[0].name if depts else None

        if not reception:
            frappe.throw("No Reception department found. Please create one first.")

        # Set priority based on reason
        priority = "Normal"
        if self.reason_for_visit == "Emergency":
            priority = "Emergency"

        # Care pathway left blank — receptionist assigns manually
        queue_entry = frappe.get_doc({
            "doctype": "Queue Entry",
            "patient": self.patient,
            "department": reception,
            "priority": priority,
            "status": "Waiting",
            "current_step": 1
        })
        queue_entry.insert(ignore_permissions=True)
        frappe.db.commit()

        self.queue_entry = queue_entry.name
        self.token_number = queue_entry.token_number