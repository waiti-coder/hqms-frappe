import frappe
from frappe.model.document import Document

class QueueCall(Document):

    def before_submit(self):
        self.called_at = frappe.utils.now()

        if self.queue_entry:
            frappe.db.set_value("Queue Entry", self.queue_entry, {
                "status": "Called",
                "called_at": self.called_at,
                "counter": self.counter
            })
            frappe.db.commit()