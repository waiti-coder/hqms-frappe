import frappe
from frappe.model.document import Document

class QueueCounter(Document):
    # begin: auto-generated types
    # This code is auto-generated. Do not modify anything in this block.

    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from frappe.types import DF

        consultation_room: DF.Link | None
        counter_name: DF.Data
        department: DF.Link | None
        is_active: DF.Check
    # end: auto-generated types

    pass