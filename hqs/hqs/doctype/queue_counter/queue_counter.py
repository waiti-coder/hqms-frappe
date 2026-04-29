import frappe
from frappe.model.document import Document

class QueueCounter(Document):
    # begin: auto-generated types
    # This code is auto-generated. Do not modify anything in this block.

    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from frappe.types import DF

        assigned_user: DF.Link | None
        counter_name: DF.Data
        display_order: DF.Int
        is_active: DF.Check
        room: DF.Link | None
    # end: auto-generated types

    pass