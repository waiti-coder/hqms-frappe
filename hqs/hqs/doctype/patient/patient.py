# Copyright (c) 2026, ed/mwihaki and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class Patient(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF
		from healthcare.healthcare.doctype.patient_relation.patient_relation import PatientRelation

		alcohol_current_use: DF.Data | None
		alcohol_past_use: DF.Data | None
		allergies: DF.SmallText | None
		blood_group: DF.Literal["", "A Positive", "A Negative", "AB Positive", "AB Negative", "B Positive", "B Negative", "O Positive", "O Negative"]
		country: DF.Link | None
		customer: DF.Link | None
		customer_group: DF.Link | None
		default_currency: DF.Link | None
		default_price_list: DF.Link | None
		dob: DF.Date | None
		email: DF.Data | None
		first_name: DF.Data
		image: DF.AttachImage | None
		inpatient_record: DF.Link | None
		inpatient_status: DF.Literal["", "Admission Scheduled", "Admitted", "Discharge Scheduled"]
		invite_user: DF.Check
		language: DF.Link | None
		last_name: DF.Data | None
		marital_status: DF.Literal["", "Single", "Married", "Divorced", "Widow"]
		medical_history: DF.SmallText | None
		medication: DF.SmallText | None
		middle_name: DF.Data | None
		mobile: DF.Data | None
		naming_series: DF.Literal["HLC-PAT-.YYYY.-"]
		occupation: DF.Data | None
		other_risk_factors: DF.SmallText | None
		patient_details: DF.Text | None
		patient_name: DF.Data | None
		patient_relation: DF.Table[PatientRelation]
		phone: DF.Data | None
		report_preference: DF.Literal["", "Email", "Print"]
		sex: DF.Link
		status: DF.Literal["Active", "Disabled"]
		surgical_history: DF.SmallText | None
		surrounding_factors: DF.SmallText | None
		territory: DF.Link | None
		tobacco_current_use: DF.Data | None
		tobacco_past_use: DF.Data | None
		uid: DF.Data | None
		user_id: DF.ReadOnly | None
	# end: auto-generated types

	pass
