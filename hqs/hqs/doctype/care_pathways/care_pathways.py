import frappe
from frappe.model.document import Document

class CarePathways(Document):

    def validate(self):
        self.validate_steps()

    def validate_steps(self):
        if not self.steps:
            frappe.throw("Please add at least one step to the pathway.")

        orders = [step.order for step in self.steps]

        # Check for duplicate order numbers
        if len(orders) != len(set(orders)):
            frappe.throw("Duplicate order numbers found in steps. Each step must have a unique order number.")

        # Check for missing departments
        for step in self.steps:
            if not step.department:
                frappe.throw(f"Step {step.order} is missing a department.")