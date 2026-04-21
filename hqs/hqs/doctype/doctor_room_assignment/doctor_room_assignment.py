# Copyright (c) 2026, ed/mwihaki and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class DoctorRoomAssignment(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		consultation_room: DF.Link | None
		date: DF.Date | None
		doctor: DF.Link | None
		status: DF.Literal["Active", "On Break", "Done"]
	# end: auto-generated types

	pass
