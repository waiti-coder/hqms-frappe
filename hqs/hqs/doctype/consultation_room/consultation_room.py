# Copyright (c) 2026, ed/mwihaki and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class ConsultationRoom(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		description: DF.SmallText | None
		room_name: DF.Data
		room_number: DF.Data | None
		status: DF.Literal["Active", "Inactive"]
	# end: auto-generated types

	pass
