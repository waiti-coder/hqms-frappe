# Copyright (c) 2026, ed/mwihaki and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class QMSRoom(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF
		from hqs.hqs.doctype.qms_room_routing.qms_room_routing import QMSRoomRouting

		active: DF.Check
		allowed_next_rooms: DF.Table[QMSRoomRouting]
		room_name: DF.Data | None
		room_type: DF.Literal["Reception", "Triage", "Lab", "Consultation", "Pharmacy", "Radiology"]
	# end: auto-generated types

	pass
