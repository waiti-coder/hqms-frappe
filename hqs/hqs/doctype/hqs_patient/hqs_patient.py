# Copyright (c) 2026, ed/mwihaki and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class HQSPatient(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		dob: DF.Date | None
		email: DF.Data | None
		first_name: DF.Data | None
		last_name: DF.Data | None
		mobile: DF.Data | None
		patient_name: DF.Data | None
		sex: DF.Link | None
		uid: DF.Data | None
	# end: auto-generated types

	pass
